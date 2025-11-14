package com.torchat.shared.crypto

import android.util.Base64
import android.util.Log
import com.goterl.lazysodium.LazySodiumAndroid
import com.goterl.lazysodium.SodiumAndroid
import com.goterl.lazysodium.interfaces.Box
import com.goterl.lazysodium.interfaces.SecretBox
import com.goterl.lazysodium.utils.Key

/**
 * E2EE Encryption Manager using libsodium
 * Provides both symmetric (SecretBox) and asymmetric (Box) encryption
 */
class CryptoManager {

    private val sodium = LazySodiumAndroid(SodiumAndroid())

    companion object {
        private const val TAG = "CryptoManager"
    }

    /**
     * Generate a new key pair for asymmetric encryption
     */
    fun generateKeyPair(): KeyPair {
        val keyPair = sodium.cryptoBoxKeypair()
        return KeyPair(
            publicKey = Base64.encodeToString(keyPair.publicKey.asBytes, Base64.NO_WRAP),
            privateKey = Base64.encodeToString(keyPair.secretKey.asBytes, Base64.NO_WRAP)
        )
    }

    /**
     * Encrypt a message using symmetric encryption (for room messages)
     */
    fun encryptSymmetric(message: String, roomKey: String): String? {
        try {
            val key = Key.fromBytes(Base64.decode(roomKey, Base64.NO_WRAP))
            val nonce = sodium.nonce(SecretBox.NONCEBYTES)
            val ciphertext = ByteArray(message.toByteArray().size + SecretBox.MACBYTES)

            val success = sodium.cryptoSecretBoxEasy(
                ciphertext,
                message.toByteArray(),
                message.toByteArray().size.toLong(),
                nonce,
                key.asBytes
            )

            if (!success) return null

            val combined = nonce + ciphertext
            return Base64.encodeToString(combined, Base64.NO_WRAP)

        } catch (e: Exception) {
            Log.e(TAG, "Encryption failed", e)
            return null
        }
    }

    /**
     * Decrypt a message using symmetric encryption
     */
    fun decryptSymmetric(encryptedMessage: String, roomKey: String): String? {
        try {
            val combined = Base64.decode(encryptedMessage, Base64.NO_WRAP)
            val nonce = combined.take(SecretBox.NONCEBYTES).toByteArray()
            val ciphertext = combined.drop(SecretBox.NONCEBYTES).toByteArray()

            val key = Key.fromBytes(Base64.decode(roomKey, Base64.NO_WRAP))
            val decrypted = ByteArray(ciphertext.size - SecretBox.MACBYTES)

            val success = sodium.cryptoSecretBoxOpenEasy(
                decrypted,
                ciphertext,
                ciphertext.size.toLong(),
                nonce,
                key.asBytes
            )

            if (!success) return null

            return String(decrypted)

        } catch (e: Exception) {
            Log.e(TAG, "Decryption failed", e)
            return null
        }
    }

    /**
     * Generate a random room key for symmetric encryption
     */
    fun generateRoomKey(): String {
        val key = sodium.cryptoSecretBoxKeygen()
        return Base64.encodeToString(key.asBytes, Base64.NO_WRAP)
    }

    /**
     * Encrypt using public key (asymmetric)
     */
    fun encryptAsymmetric(
        message: String,
        recipientPublicKey: String,
        senderPrivateKey: String
    ): String? {
        try {
            val publicKey = Key.fromBytes(Base64.decode(recipientPublicKey, Base64.NO_WRAP))
            val privateKey = Key.fromBytes(Base64.decode(senderPrivateKey, Base64.NO_WRAP))
            val nonce = sodium.nonce(Box.NONCEBYTES)
            val ciphertext = ByteArray(message.toByteArray().size + Box.MACBYTES)

            val success = sodium.cryptoBoxEasy(
                ciphertext,
                message.toByteArray(),
                message.toByteArray().size.toLong(),
                nonce,
                publicKey.asBytes,
                privateKey.asBytes
            )

            if (!success) return null

            val combined = nonce + ciphertext
            return Base64.encodeToString(combined, Base64.NO_WRAP)

        } catch (e: Exception) {
            Log.e(TAG, "Asymmetric encryption failed", e)
            return null
        }
    }

    /**
     * Decrypt using private key (asymmetric)
     */
    fun decryptAsymmetric(
        encryptedMessage: String,
        senderPublicKey: String,
        recipientPrivateKey: String
    ): String? {
        try {
            val combined = Base64.decode(encryptedMessage, Base64.NO_WRAP)
            val nonce = combined.take(Box.NONCEBYTES).toByteArray()
            val ciphertext = combined.drop(Box.NONCEBYTES).toByteArray()

            val publicKey = Key.fromBytes(Base64.decode(senderPublicKey, Base64.NO_WRAP))
            val privateKey = Key.fromBytes(Base64.decode(recipientPrivateKey, Base64.NO_WRAP))
            val decrypted = ByteArray(ciphertext.size - Box.MACBYTES)

            val success = sodium.cryptoBoxOpenEasy(
                decrypted,
                ciphertext,
                ciphertext.size.toLong(),
                nonce,
                publicKey.asBytes,
                privateKey.asBytes
            )

            if (!success) return null

            return String(decrypted)

        } catch (e: Exception) {
            Log.e(TAG, "Asymmetric decryption failed", e)
            return null
        }
    }
}

data class KeyPair(
    val publicKey: String,
    val privateKey: String
)
