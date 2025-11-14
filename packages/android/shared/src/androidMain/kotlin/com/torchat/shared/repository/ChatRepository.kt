package com.torchat.shared.repository

import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.torchat.shared.models.*
import com.torchat.shared.tor.TorManager
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.okhttp.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import java.net.InetSocketAddress
import java.net.Proxy

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "tor_chat_prefs")

/**
 * Repository for chat operations over TOR
 * Handles authentication, rooms, and messages
 */
class ChatRepository(
    private val context: Context,
    private val torManager: TorManager
) {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val AUTH_TOKEN_KEY = stringPreferencesKey("auth_token")
    private val SERVER_URL_KEY = stringPreferencesKey("server_url")

    // Default to localhost for development
    private var baseUrl = "http://localhost:3000"

    companion object {
        private const val TAG = "ChatRepository"
    }

    /**
     * Create HTTP client that routes through TOR
     */
    private fun createHttpClient(): HttpClient {
        val (proxyHost, proxyPort) = torManager.getSocksProxy()

        val okHttpClient = OkHttpClient.Builder()
            .proxy(Proxy(Proxy.Type.SOCKS, InetSocketAddress(proxyHost, proxyPort)))
            .build()

        return HttpClient(OkHttp) {
            engine {
                preconfigured = okHttpClient
            }
            install(ContentNegotiation) {
                json(json)
            }
        }
    }

    /**
     * Login user
     */
    suspend fun login(username: String, password: String): Result<AuthResponse> {
        return try {
            val client = createHttpClient()
            val response: AuthResponse = client.post("$baseUrl/api/auth/login") {
                contentType(ContentType.Application.Json)
                setBody(LoginRequest(username, password))
            }.body()

            if (response.success && response.token != null) {
                saveAuthToken(response.token)
            }

            client.close()
            Result.success(response)
        } catch (e: Exception) {
            Log.e(TAG, "Login failed", e)
            Result.failure(e)
        }
    }

    /**
     * Register new user
     */
    suspend fun register(username: String, password: String): Result<AuthResponse> {
        return try {
            val client = createHttpClient()
            val response: AuthResponse = client.post("$baseUrl/api/auth/register") {
                contentType(ContentType.Application.Json)
                setBody(RegisterRequest(username, password))
            }.body()

            if (response.success && response.token != null) {
                saveAuthToken(response.token)
            }

            client.close()
            Result.success(response)
        } catch (e: Exception) {
            Log.e(TAG, "Registration failed", e)
            Result.failure(e)
        }
    }

    /**
     * Get all available rooms
     */
    suspend fun getRooms(): Result<List<Room>> {
        return try {
            val client = createHttpClient()
            val token = getAuthToken()

            val response: List<Room> = client.get("$baseUrl/api/rooms") {
                if (token != null) {
                    header("Authorization", "Bearer $token")
                }
            }.body()

            client.close()
            Result.success(response)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get rooms", e)
            Result.failure(e)
        }
    }

    /**
     * Get messages for a room
     */
    suspend fun getMessages(roomId: String): Result<List<Message>> {
        return try {
            val client = createHttpClient()
            val token = getAuthToken()

            val response: List<Message> = client.get("$baseUrl/api/rooms/$roomId/messages") {
                if (token != null) {
                    header("Authorization", "Bearer $token")
                }
            }.body()

            client.close()
            Result.success(response)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get messages", e)
            Result.failure(e)
        }
    }

    /**
     * Send a message to a room
     */
    suspend fun sendMessage(roomId: String, content: String): Result<Message> {
        return try {
            val client = createHttpClient()
            val token = getAuthToken()

            val response: Message = client.post("$baseUrl/api/rooms/$roomId/messages") {
                contentType(ContentType.Application.Json)
                if (token != null) {
                    header("Authorization", "Bearer $token")
                }
                setBody(SendMessageRequest(roomId, content))
            }.body()

            client.close()
            Result.success(response)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send message", e)
            Result.failure(e)
        }
    }

    /**
     * Save authentication token
     */
    private suspend fun saveAuthToken(token: String) {
        context.dataStore.edit { preferences ->
            preferences[AUTH_TOKEN_KEY] = token
        }
    }

    /**
     * Get stored authentication token
     */
    suspend fun getAuthToken(): String? {
        return context.dataStore.data.first()[AUTH_TOKEN_KEY]
    }

    /**
     * Get authentication token as Flow
     */
    fun getAuthTokenFlow(): Flow<String?> {
        return context.dataStore.data.map { it[AUTH_TOKEN_KEY] }
    }

    /**
     * Clear authentication (logout)
     */
    suspend fun clearAuth() {
        context.dataStore.edit { it.clear() }
    }

    /**
     * Set server URL
     */
    suspend fun setServerUrl(url: String) {
        baseUrl = url
        context.dataStore.edit { preferences ->
            preferences[SERVER_URL_KEY] = url
        }
    }

    /**
     * Get server URL
     */
    suspend fun getServerUrl(): String {
        return context.dataStore.data.first()[SERVER_URL_KEY] ?: baseUrl
    }
}
