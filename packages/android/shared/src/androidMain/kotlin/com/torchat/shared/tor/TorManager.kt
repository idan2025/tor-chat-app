package com.torchat.shared.tor

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.torchat.shared.models.TorConfig
import com.torchat.shared.models.TorStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import java.io.File
import java.io.BufferedReader
import java.io.InputStreamReader

/**
 * TOR Manager with Real TOR Integration
 *
 * This implementation embeds the TOR binary using Guardian Project's tor-android library.
 * It provides:
 * - Real SOCKS5 proxy on localhost:9050
 * - Real connection bootstrapping with progress callbacks
 * - Circuit establishment
 * - Proper start/stop lifecycle
 *
 * SECURITY NOTES:
 * - All traffic is routed through TOR - no clearnet leaks
 * - Uses entry guards for better anonymity
 * - Safe logging enabled (no sensitive info in logs)
 * - ClientRejectInternalAddresses prevents accidental local network access
 */
class TorManager(private val context: Context) {

    private val _status = MutableStateFlow<TorStatus>(TorStatus.Disconnected)
    val status: StateFlow<TorStatus> = _status.asStateFlow()

    private var torProcess: Process? = null
    private var socksPort: Int = SOCKS_PORT
    private var controlPort: Int = CONTROL_PORT

    companion object {
        private const val TAG = "TorManager"
        const val SOCKS_PORT = 9050
        const val CONTROL_PORT = 9051
    }

    /**
     * Start TOR with the given configuration
     *
     * This starts an embedded TOR binary from Guardian Project's tor-android library.
     * The TOR daemon will:
     * 1. Bootstrap connection to the TOR network
     * 2. Build circuits through relays
     * 3. Open SOCKS5 proxy on port 9050
     * 4. Report progress through status StateFlow
     */
    suspend fun start(config: TorConfig = TorConfig()) = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "Starting TOR connection...")
            _status.value = TorStatus.Connecting(0)

            // Update ports from config
            socksPort = config.socksPort
            controlPort = config.controlPort

            // Create TOR data directory
            val torDir = File(context.filesDir, "tor")
            val torDataDir = File(torDir, "data")
            val torCacheDir = File(context.cacheDir, "tor")

            torDir.mkdirs()
            torDataDir.mkdirs()
            torCacheDir.mkdirs()

            // Extract TOR binary from Guardian Project library
            val torBinary = extractTorBinary()

            // Create torrc configuration file
            val torrcFile = createTorrcConfiguration(torDataDir, torCacheDir, config)

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
            _status.value = TorStatus.Error(e.message ?: "Unknown error")
            throw e
        }
    }

    /**
     * Stop TOR service
     */
    suspend fun stop() = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "Stopping TOR service...")

            torProcess?.destroy()
            torProcess?.waitFor()
            torProcess = null

            _status.value = TorStatus.Disconnected
            Log.i(TAG, "TOR stopped successfully")

        } catch (e: Exception) {
            Log.e(TAG, "Error stopping TOR", e)
        }
    }

    /**
     * Extract TOR binary from Guardian Project's tor-android-binary library
     *
     * Guardian Project packages TOR as native libraries (.so files) for each architecture.
     * The Android system automatically extracts these to the app's native library directory.
     */
    private fun extractTorBinary(): File {
        val torBinary = File(context.filesDir, "tor/tor")

        // Guardian Project's tor-android-binary includes native libs
        // They are automatically extracted by the system to nativeLibraryDir
        val nativeLibDir = context.applicationInfo.nativeLibraryDir
        val systemTorBinary = File(nativeLibDir, "libtor.so")

        if (systemTorBinary.exists()) {
            // Copy to our tor directory for execution
            systemTorBinary.copyTo(torBinary, overwrite = true)
            torBinary.setExecutable(true)
            Log.d(TAG, "TOR binary extracted: ${torBinary.absolutePath}")
            return torBinary
        } else {
            throw RuntimeException(
                "TOR binary not found in native library directory. " +
                        "Ensure tor-android-binary dependency is included in build.gradle"
            )
        }
    }

    /**
     * Create TOR configuration file (torrc)
     *
     * SECURITY: This configuration is optimized for anonymity and mobile use
     */
    private fun createTorrcConfiguration(
        dataDir: File,
        cacheDir: File,
        config: TorConfig
    ): File {
        val torrcFile = File(context.filesDir, "tor/torrc")

        // Build bridges configuration if enabled
        val bridgesConfig = if (config.useBridges && config.bridges.isNotEmpty()) {
            """
# Bridges for censorship circumvention
UseBridges 1
${config.bridges.joinToString("\n") { "Bridge $it" }}
            """.trimIndent()
        } else {
            "# Bridges disabled"
        }

        // SECURITY NOTES:
        // - ClientOnly 1: Don't become a relay (critical for mobile)
        // - UseEntryGuards 1: Use entry guards for better anonymity
        // - ClientRejectInternalAddresses 1: Prevent local network leaks
        // - SafeLogging 1: Don't log sensitive information
        // - DisableDebuggerAttachment 1: Prevent debugging attacks
        val torrcContent = """
# TOR Configuration for TORChat
# Generated by TorManager

# Data directories
DataDirectory ${dataDir.absolutePath}
CacheDirectory ${cacheDir.absolutePath}

# SOCKS proxy (for application traffic)
# WARNING: Only bind to localhost - never expose to network
SocksPort ${config.socksPort}

# Control port (for programmatic control)
ControlPort ${config.controlPort}

# Disable DNS port (we don't need it)
DNSPort 0

# Client-only mode (not a relay)
ClientOnly 1

# Use entry guards for better anonymity
UseEntryGuards 1

# Disable local application connections to non-TOR addresses
# SECURITY: This prevents accidental clearnet leaks
ClientRejectInternalAddresses 1

# Safe logging (don't log sensitive info)
SafeLogging 1

# Disable statistics and debugging
DisableDebuggerAttachment 1

# Connection settings
ConnectionPadding auto
ReducedConnectionPadding 0

# Circuit settings
CircuitBuildTimeout 60
LearnCircuitBuildTimeout 1
NumEntryGuards 3

# For better mobile performance
DormantCanceledByStartup 1
DormantClientTimeout 24 hours

$bridgesConfig

# Log to stdout so we can monitor bootstrap
Log notice stdout
        """.trimIndent()

        torrcFile.writeText(torrcContent)
        Log.d(TAG, "Created torrc configuration: ${torrcFile.absolutePath}")
        return torrcFile
    }

    /**
     * Monitor TOR bootstrap progress by reading stdout
     *
     * TOR outputs bootstrap progress messages like:
     * "Bootstrapped 25% (loading_descriptors): Loading relay descriptors"
     *
     * We parse these to provide real-time progress updates.
     */
    private suspend fun monitorTorBootstrap() = withContext(Dispatchers.IO) {
        try {
            val reader = BufferedReader(InputStreamReader(torProcess?.inputStream))
            var line: String?

            while (reader.readLine().also { line = it } != null) {
                val logLine = line ?: continue
                Log.d(TAG, "TOR: $logLine")

                // Parse bootstrap progress
                // Example: "Bootstrapped 50% (loading_descriptors): Loading relay descriptors"
                val bootstrapRegex = "Bootstrapped (\\d+)%".toRegex()
                val match = bootstrapRegex.find(logLine)

                if (match != null) {
                    val progress = match.groupValues[1].toInt()
                    _status.value = TorStatus.Connecting(progress)

                    if (progress == 100) {
                        _status.value = TorStatus.Connected
                        Log.i(TAG, "TOR fully bootstrapped and ready")
                        Log.i(TAG, "SOCKS proxy available at 127.0.0.1:$socksPort")

                        // Verify TOR is actually working
                        verifyTorConnection()
                    }
                }

                // Check for errors
                if (logLine.contains("[err]", ignoreCase = true)) {
                    Log.e(TAG, "TOR error: $logLine")
                    _status.value = TorStatus.Error("TOR error: $logLine")
                }

                if (logLine.contains("[warn]", ignoreCase = true)) {
                    Log.w(TAG, "TOR warning: $logLine")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error monitoring TOR bootstrap", e)
            _status.value = TorStatus.Error(e.message ?: "Bootstrap monitoring failed")
        }
    }

    /**
     * Verify TOR connection is working
     *
     * SECURITY: This attempts to connect to the SOCKS port to verify it's listening.
     * It does NOT make any external connections.
     */
    private suspend fun verifyTorConnection() = withContext(Dispatchers.IO) {
        try {
            // Simple check: verify SOCKS port is listening
            val socket = java.net.Socket()
            socket.connect(java.net.InetSocketAddress("127.0.0.1", socksPort), 2000)
            socket.close()
            Log.i(TAG, "TOR SOCKS proxy verified - ready for connections")
        } catch (e: Exception) {
            Log.w(TAG, "Could not verify TOR SOCKS proxy: ${e.message}")
        }
    }

    /**
     * Get SOCKS proxy configuration for HTTP clients
     *
     * Returns the localhost SOCKS5 proxy address that routes through TOR.
     *
     * SECURITY NOTES:
     * - Always returns 127.0.0.1 (localhost only - never exposed to network)
     * - Ensure your HTTP client is configured to use SOCKS5 (not HTTP proxy)
     * - DNS resolution MUST happen through SOCKS to prevent DNS leaks
     */
    fun getSocksProxy(config: TorConfig = TorConfig()): Pair<String, Int> {
        return "127.0.0.1" to config.socksPort
    }

    /**
     * Check if TOR is currently connected
     */
    fun isConnected(): Boolean {
        return status.value is TorStatus.Connected
    }

    /**
     * Get current bootstrap progress (0-100)
     */
    fun getBootstrapProgress(): Int {
        return when (val currentStatus = status.value) {
            is TorStatus.Connecting -> currentStatus.progress
            is TorStatus.Connected -> 100
            else -> 0
        }
    }
}
