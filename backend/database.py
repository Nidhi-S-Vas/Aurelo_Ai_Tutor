# database.py
from dotenv import load_dotenv
load_dotenv()

import os
from urllib.parse import quote_plus
from pymongo import MongoClient
from pymongo.errors import InvalidURI, ConfigurationError, ServerSelectionTimeoutError

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "project_tutor")

# Validate and connect to MongoDB
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    # Test connection
    client.server_info()
except InvalidURI as e:
    error_msg = str(e)
    print("\n" + "="*70)
    print("❌ MONGODB URI ERROR: Special Characters Need URL Encoding")
    print("="*70)
    print("\nYour MongoDB connection string contains special characters")
    print("(like @, #, %, &, etc.) in username or password that need")
    print("to be URL-encoded according to RFC 3986.\n")
    print("QUICK FIXES:\n")
    print("1. For LOCAL MongoDB (no authentication):")
    print("   MONGO_URI=mongodb://localhost:27017")
    print("   (No quotes, no spaces)\n")
    print("2. To encode your password/username, run:")
    print("   python backend/encode_mongo_uri.py")
    print("   OR use this command:")
    print("   python -c \"from urllib.parse import quote_plus; print(quote_plus('YOUR_PASSWORD'))\"\n")
    print("3. Check your .env file:")
    print("   - Location: backend/.env")
    print("   - Current MONGO_URI value contains special characters")
    print("   - Make sure there are no extra quotes or spaces\n")
    print("4. Example encoded URI format:")
    print("   mongodb://username:encoded_password@host:port/database")
    print("   mongodb+srv://username:encoded_password@cluster.mongodb.net/database\n")
    print("="*70)
    print("\n💡 TIP: Run 'python backend/encode_mongo_uri.py' for interactive help\n")
    raise
except ServerSelectionTimeoutError:
    print("\n" + "="*70)
    print("❌ MONGODB CONNECTION TIMEOUT")
    print("="*70)
    print("\nCannot connect to MongoDB. Please check:")
    print("1. MongoDB service is running (for local):")
    print("   - Windows: Check Services app or run 'net start MongoDB' as admin")
    print("   - Test: Run 'mongosh' in terminal\n")
    print("2. MONGO_URI is correct in backend/.env:")
    print(f"   Current: {MONGO_URI}\n")
    print("3. Network/firewall settings (for MongoDB Atlas)")
    print("="*70 + "\n")
    raise
except Exception as e:
    error_msg = str(e)
    print(f"\n❌ MongoDB Connection Error: {error_msg}\n")
    print("Troubleshooting:")
    print(f"1. Check MONGO_URI in backend/.env: {MONGO_URI[:50]}...")
    print("2. Verify MongoDB is running")
    print("3. Check network/firewall settings\n")
    raise

db = client[MONGO_DB_NAME]

# Users collection (for authentication)
users_collection = db["users"]
# Create unique indexes for username and email
users_collection.create_index("username", unique=True)
users_collection.create_index("email", unique=True)

# Documents collection (stores llm_output + metadata)
# Documents are now scoped to users via user_id field
documents_collection = db["documents"]
# Create index for faster queries by user_id and doc_id
documents_collection.create_index([("user_id", 1), ("doc_id", 1)])

# Exam results collection (stores user exam attempts, scores, and tips)
exam_results_collection = db["exam_results"]
# Create indexes for faster queries
exam_results_collection.create_index([("user_id", 1), ("created_at", -1)])
exam_results_collection.create_index([("user_id", 1), ("doc_id", 1), ("exam_type", 1)])
