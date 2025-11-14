package com.torchat.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.torchat.MainActivity
import com.torchat.R
import com.torchat.shared.models.TorStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File

/**
 * Foreground service for running TOR daemon
 *
 * This service ensures TOR continues running even when the app is backgrounded.
 * It provides a persistent notification and manages the TOR lifecycle.
 */
class TorService : Service() {

    private val binder = TorServiceBinder()
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _torStatus = MutableStateFlow<TorStatus>(TorStatus.Disconnected)
    val torStatus: StateFlow<TorStatus> = _torStatus.asStateFlow()

    // Will be initialized when TOR starts
    private var torProcess: Process? = null
    private var socksPort: Int = 9050
    private var controlPort: Int = 9051

    inner class TorServiceBinder : Binder() {
        fun getService(): TorService = this@TorService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "TorService created")
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "TorService started")

        // Start foreground service with notification
        val notification = createNotification("TOR is starting...")
        startForeground(NOTIFICATION_ID, notification)

        // Start TOR in background
        serviceScope.launch {
            startTor()
        }

        // Service will be restarted if killed by system
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "TorService destroyed")
        serviceScope.launch {
            stopTor()
        }
        serviceScope.cancel()
    }

    /**
     * Start the TOR process
     */
    private suspend fun startTor() {
        try {
            Log.d(TAG, "Starting TOR daemon...")
            _torStatus.value = TorStatus.Connecting(0)

            // Create TOR data directory
            val torDir = File(applicationContext.filesDir, "tor")
            val torDataDir = File(torDir, "data")
            val torCacheDir = File(applicationContext.cacheDir, "tor")

            torDir.mkdirs()
            torDataDir.mkdirs()
            torCacheDir.mkdirs()

            // Extract TOR binary from assets (Guardian Project tor-android)
            val torBinary = extractTorBinary()

            // Create torrc configuration file
            val torrcFile = createTorrcConfiguration(torDataDir, torCacheDir)

            // Start TOR process
            Log.d(TAG, "Launching TOR binary: ${torBinary.absolutePath}")
            val processBuilder = ProcessBuilder(
                torBinary.absolutePath,
                "-f", torrcFile.absolutePath
            )
            processBuilder.redirectErrorStream(true)

            torProcess = processBuilder.start()

            // Monitor TOR bootstrap progress
            monitorTorBootstrap()

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start TOR", e)
            _torStatus.value = TorStatus.Error(e.message ?: "Unknown error")
            updateNotification("TOR failed to start: ${e.message}")
        }
    }

    /**
     * Extract TOR binary from Guardian Project library
     */
    private fun extractTorBinary(): File {
        val torBinary = File(applicationContext.filesDir, "tor/tor")

        // Guardian Project's tor-android-binary includes native libs
        // They are automatically extracted by the system to nativeLibraryDir
        val nativeLibDir = applicationContext.applicationInfo.nativeLibraryDir
        val systemTorBinary = File(nativeLibDir, "libtor.so")

        if (systemTorBinary.exists()) {
            // Copy to our tor directory for execution
            systemTorBinary.copyTo(torBinary, overwrite = true)
            torBinary.setExecutable(true)
            Log.d(TAG, "TOR binary extracted: ${torBinary.absolutePath}")
            return torBinary
        } else {
            throw RuntimeException("TOR binary not found in native library directory")
        }
    }

    /**
     * Create TOR configuration file (torrc)
     */
    private fun createTorrcConfiguration(dataDir: File, cacheDir: File): File {
        val torrcFile = File(applicationContext.filesDir, "tor/torrc")

        // SECURITY: This torrc is configured for maximum anonymity
        val torrcContent = """
# TOR Configuration for TORChat
# Generated by TorService

# Data directories
DataDirectory ${dataDir.absolutePath}
CacheDirectory ${cacheDir.absolutePath}

# SOCKS proxy (for application traffic)
SocksPort $socksPort

# Control port (for programmatic control)
ControlPort $controlPort

# Disable DNS port (we don't need it)
DNSPort 0

# Client-only mode (not a relay)
ClientOnly 1

# Use entry guards for better anonymity
UseEntryGuards 1

# Disable local application connections to non-TOR addresses
# This prevents accidental clearnet leaks
ClientRejectInternalAddresses 1

# Safe logging (don't log sensitive info)
SafeLogging 1

# Disable statistics
DisableDebuggerAttachment 1

# Connection settings
ConnectionPadding auto
ReducedConnectionPadding 0

# Circuit settings
CircuitBuildTimeout 60
LearnCircuitBuildTimeout 1

# For better mobile performance
DormantCanceledByStartup 1
DormantClientTimeout 24 hours

# Log to stdout so we can monitor bootstrap
Log notice stdout
        """.trimIndent()

        torrcFile.writeText(torrcContent)
        Log.d(TAG, "Created torrc configuration: ${torrcFile.absolutePath}")
        return torrcFile
    }

    /**
     * Monitor TOR bootstrap progress by reading stdout
     */
    private fun monitorTorBootstrap() {
        serviceScope.launch {
            try {
                val reader = torProcess?.inputStream?.bufferedReader()
                reader?.useLines { lines ->
                    for (line in lines) {
                        Log.d(TAG, "TOR: $line")

                        // Parse bootstrap progress
                        // Example: "Bootstrapped 50% (loading_descriptors): Loading relay descriptors"
                        val bootstrapRegex = "Bootstrapped (\\d+)%".toRegex()
                        val match = bootstrapRegex.find(line)

                        if (match != null) {
                            val progress = match.groupValues[1].toInt()
                            _torStatus.value = TorStatus.Connecting(progress)
                            updateNotification("TOR connecting: $progress%")

                            if (progress == 100) {
                                _torStatus.value = TorStatus.Connected
                                updateNotification("TOR connected")
                                Log.i(TAG, "TOR fully bootstrapped and ready")
                            }
                        }

                        // Check for errors
                        if (line.contains("[err]", ignoreCase = true) ||
                            line.contains("[warn]", ignoreCase = true)
                        ) {
                            Log.w(TAG, "TOR warning/error: $line")
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error monitoring TOR bootstrap", e)
                _torStatus.value = TorStatus.Error(e.message ?: "Bootstrap monitoring failed")
            }
        }
    }

    /**
     * Stop TOR process
     */
    private suspend fun stopTor() {
        try {
            Log.d(TAG, "Stopping TOR daemon...")

            torProcess?.destroy()
            torProcess?.waitFor()
            torProcess = null

            _torStatus.value = TorStatus.Disconnected
            Log.i(TAG, "TOR stopped successfully")

        } catch (e: Exception) {
            Log.e(TAG, "Error stopping TOR", e)
        }
    }

    /**
     * Get SOCKS proxy configuration
     */
    fun getSocksProxy(): Pair<String, Int> {
        return "127.0.0.1" to socksPort
    }

    /**
     * Check if TOR is connected
     */
    fun isConnected(): Boolean {
        return _torStatus.value is TorStatus.Connected
    }

    // Notification management

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "TOR Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps TOR connection active"
                setShowBadge(false)
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(message: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("TOR Connection")
            .setContentText(message)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(message: String) {
        val notification = createNotification(message)
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    companion object {
        private const val TAG = "TorService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "tor_service_channel"
    }
}
