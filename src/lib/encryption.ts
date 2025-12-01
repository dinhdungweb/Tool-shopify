import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment variable
 * If not set, generate a random one (for development only)
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    console.warn(
      "⚠️  ENCRYPTION_KEY not set in .env file. Using a temporary key. " +
      "This is NOT secure for production!"
    );
    // Generate a temporary key for development
    return crypto.randomBytes(32).toString("hex");
  }
  
  return key;
}

/**
 * Derive a key from the encryption key using PBKDF2
 */
function deriveKey(salt: Buffer): Buffer {
  const encryptionKey = getEncryptionKey();
  return crypto.pbkdf2Sync(encryptionKey, salt, ITERATIONS, KEY_LENGTH, "sha512");
}

/**
 * Encrypt a string value
 * Returns: salt:iv:tag:encryptedData (all in hex)
 */
export function encrypt(text: string): string {
  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive key from encryption key + salt
    const key = deriveKey(salt);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    // Get auth tag
    const tag = cipher.getAuthTag();
    
    // Combine: salt:iv:tag:encryptedData
    return [
      salt.toString("hex"),
      iv.toString("hex"),
      tag.toString("hex"),
      encrypted,
    ].join(":");
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt an encrypted string
 * Input format: salt:iv:tag:encryptedData (all in hex)
 */
export function decrypt(encryptedText: string): string {
  try {
    // Split the encrypted text
    const parts = encryptedText.split(":");
    
    if (parts.length !== 4) {
      throw new Error("Invalid encrypted data format");
    }
    
    const [saltHex, ivHex, tagHex, encrypted] = parts;
    
    // Convert from hex
    const salt = Buffer.from(saltHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    
    // Derive key
    const key = deriveKey(salt);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Test encryption/decryption
 */
export function testEncryption(): boolean {
  try {
    const testData = "Hello, World! 🔐";
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    return testData === decrypted;
  } catch (error) {
    console.error("Encryption test failed:", error);
    return false;
  }
}
