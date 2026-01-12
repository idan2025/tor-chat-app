use crate::error::{AppError, Result};
use sodiumoxide::crypto::{box_, secretbox};
use sodiumoxide::randombytes;

pub struct CryptoService;

impl CryptoService {
    pub fn new() -> Self {
        sodiumoxide::init().expect("Failed to initialize sodiumoxide");
        Self
    }

    /// Generate keypair for user (asymmetric)
    pub fn generate_keypair(&self) -> Result<(String, String)> {
        let (public_key, secret_key) = box_::gen_keypair();

        Ok((
            base64::encode(public_key.as_ref()),
            base64::encode(secret_key.as_ref()),
        ))
    }

    /// Encrypt message for recipient (asymmetric)
    pub fn encrypt_message(
        &self,
        message: &str,
        recipient_public_key: &str,
        sender_private_key: &str,
    ) -> Result<String> {
        let recipient_pk = box_::PublicKey::from_slice(
            &base64::decode(recipient_public_key)
                .map_err(|e| AppError::Encryption(e.to_string()))?,
        )
        .ok_or_else(|| AppError::Encryption("Invalid public key".to_string()))?;

        let sender_sk = box_::SecretKey::from_slice(
            &base64::decode(sender_private_key).map_err(|e| AppError::Encryption(e.to_string()))?,
        )
        .ok_or_else(|| AppError::Encryption("Invalid private key".to_string()))?;

        let nonce = box_::gen_nonce();
        let ciphertext = box_::seal(message.as_bytes(), &nonce, &recipient_pk, &sender_sk);

        let mut combined = nonce.as_ref().to_vec();
        combined.extend_from_slice(&ciphertext);

        Ok(base64::encode(&combined))
    }

    /// Decrypt message (asymmetric)
    pub fn decrypt_message(
        &self,
        encrypted_message: &str,
        sender_public_key: &str,
        recipient_private_key: &str,
    ) -> Result<String> {
        let combined =
            base64::decode(encrypted_message).map_err(|e| AppError::Encryption(e.to_string()))?;

        if combined.len() < box_::NONCEBYTES {
            return Err(AppError::Encryption(
                "Invalid encrypted message".to_string(),
            ));
        }

        let nonce = box_::Nonce::from_slice(&combined[..box_::NONCEBYTES])
            .ok_or_else(|| AppError::Encryption("Invalid nonce".to_string()))?;

        let ciphertext = &combined[box_::NONCEBYTES..];

        let sender_pk = box_::PublicKey::from_slice(
            &base64::decode(sender_public_key).map_err(|e| AppError::Encryption(e.to_string()))?,
        )
        .ok_or_else(|| AppError::Encryption("Invalid public key".to_string()))?;

        let recipient_sk = box_::SecretKey::from_slice(
            &base64::decode(recipient_private_key)
                .map_err(|e| AppError::Encryption(e.to_string()))?,
        )
        .ok_or_else(|| AppError::Encryption("Invalid private key".to_string()))?;

        let decrypted = box_::open(ciphertext, &nonce, &sender_pk, &recipient_sk)
            .map_err(|_| AppError::Encryption("Decryption failed".to_string()))?;

        String::from_utf8(decrypted).map_err(|e| AppError::Encryption(e.to_string()))
    }

    /// Encrypt room message (symmetric)
    pub fn encrypt_room_message(&self, message: &str, room_key: &str) -> Result<String> {
        let key = secretbox::Key::from_slice(
            &base64::decode(room_key).map_err(|e| AppError::Encryption(e.to_string()))?,
        )
        .ok_or_else(|| AppError::Encryption("Invalid room key".to_string()))?;

        let nonce = secretbox::gen_nonce();
        let ciphertext = secretbox::seal(message.as_bytes(), &nonce, &key);

        let mut combined = nonce.as_ref().to_vec();
        combined.extend_from_slice(&ciphertext);

        Ok(base64::encode(&combined))
    }

    /// Decrypt room message (symmetric)
    pub fn decrypt_room_message(&self, encrypted_message: &str, room_key: &str) -> Result<String> {
        let combined =
            base64::decode(encrypted_message).map_err(|e| AppError::Encryption(e.to_string()))?;

        if combined.len() < secretbox::NONCEBYTES {
            return Err(AppError::Encryption(
                "Invalid encrypted message".to_string(),
            ));
        }

        let nonce = secretbox::Nonce::from_slice(&combined[..secretbox::NONCEBYTES])
            .ok_or_else(|| AppError::Encryption("Invalid nonce".to_string()))?;

        let ciphertext = &combined[secretbox::NONCEBYTES..];

        let key = secretbox::Key::from_slice(
            &base64::decode(room_key).map_err(|e| AppError::Encryption(e.to_string()))?,
        )
        .ok_or_else(|| AppError::Encryption("Invalid room key".to_string()))?;

        let decrypted = secretbox::open(ciphertext, &nonce, &key)
            .map_err(|_| AppError::Encryption("Decryption failed".to_string()))?;

        String::from_utf8(decrypted).map_err(|e| AppError::Encryption(e.to_string()))
    }

    /// Generate random room key
    pub fn generate_room_key(&self) -> String {
        let key = secretbox::gen_key();
        base64::encode(key.as_ref())
    }

    /// Hash data
    pub fn hash(&self, data: &str) -> String {
        use sodiumoxide::crypto::generichash;
        let hash = generichash::hash(data.as_bytes(), None, None).unwrap();
        base64::encode(hash.as_ref())
    }

    /// Generate random bytes
    pub fn random_bytes(&self, length: usize) -> String {
        let bytes = randombytes::randombytes(length);
        base64::encode(&bytes)
    }
}
