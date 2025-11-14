package com.torchat

import android.app.Application
import android.util.Log
import com.torchat.shared.crypto.CryptoManager
import com.torchat.shared.repository.ChatRepository
import com.torchat.shared.socket.SocketManager
import com.torchat.shared.tor.TorManager

class TorChatApplication : Application() {

    lateinit var torManager: TorManager
        private set

    lateinit var chatRepository: ChatRepository
        private set

    lateinit var cryptoManager: CryptoManager
        private set

    lateinit var socketManager: SocketManager
        private set

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Initializing TOR Chat Application")

        // Initialize managers
        torManager = TorManager(this)
        chatRepository = ChatRepository(this, torManager)
        cryptoManager = CryptoManager()
        socketManager = SocketManager(torManager)

        Log.i(TAG, "TOR Chat Application initialized")
    }

    companion object {
        private const val TAG = "TorChatApp"
    }
}
