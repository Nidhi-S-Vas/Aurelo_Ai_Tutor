"""
Helper script to encode MongoDB URI with special characters.

Usage:
    python encode_mongo_uri.py

This script helps you properly encode special characters in your MongoDB
connection string, especially useful for passwords with special characters.
"""

from urllib.parse import quote_plus

def encode_uri_component(text: str) -> str:
    """URL-encode a component (username or password)."""
    return quote_plus(text)

def build_mongo_uri(username: str = None, password: str = None, 
                   host: str = "localhost", port: int = 27017,
                   database: str = "project_tutor", 
                   is_atlas: bool = False) -> str:
    """Build a properly encoded MongoDB URI."""
    if is_atlas:
        if not username or not password:
            raise ValueError("Username and password required for Atlas")
        encoded_user = encode_uri_component(username)
        encoded_pass = encode_uri_component(password)
        return f"mongodb+srv://{encoded_user}:{encoded_pass}@{host}/{database}?retryWrites=true&w=majority"
    else:
        if username and password:
            encoded_user = encode_uri_component(username)
            encoded_pass = encode_uri_component(password)
            return f"mongodb://{encoded_user}:{encoded_pass}@{host}:{port}/{database}"
        else:
            return f"mongodb://{host}:{port}/{database}"

def main():
    print("="*70)
    print("MongoDB URI Encoder Helper")
    print("="*70)
    print()
    
    print("Choose an option:")
    print("1. Encode a password/username (just the special characters part)")
    print("2. Build a complete MongoDB URI")
    print("3. Encode existing MongoDB URI components")
    print()
    
    choice = input("Enter choice (1/2/3): ").strip()
    
    if choice == "1":
        print("\n" + "-"*70)
        text = input("Enter text to encode (password/username): ").strip()
        encoded = encode_uri_component(text)
        print(f"\n✅ Encoded: {encoded}")
        print(f"\nOriginal: {text}")
        print(f"Encoded:  {encoded}")
        print("\nUse the encoded version in your MONGO_URI")
        
    elif choice == "2":
        print("\n" + "-"*70)
        is_atlas = input("Is this for MongoDB Atlas? (y/n): ").strip().lower() == 'y'
        
        if is_atlas:
            username = input("Enter username: ").strip()
            password = input("Enter password (will be encoded): ").strip()
            cluster = input("Enter cluster address (e.g., cluster0.xxxxx.mongodb.net): ").strip()
            database = input("Enter database name [project_tutor]: ").strip() or "project_tutor"
            
            uri = build_mongo_uri(username=username, password=password, 
                                 host=cluster, database=database, is_atlas=True)
        else:
            has_auth = input("Does MongoDB require authentication? (y/n): ").strip().lower() == 'y'
            username = None
            password = None
            
            if has_auth:
                username = input("Enter username: ").strip()
                password = input("Enter password (will be encoded): ").strip()
            
            host = input("Enter host [localhost]: ").strip() or "localhost"
            port = input("Enter port [27017]: ").strip() or "27017"
            try:
                port = int(port)
            except:
                port = 27017
            database = input("Enter database name [project_tutor]: ").strip() or "project_tutor"
            
            uri = build_mongo_uri(username=username, password=password,
                                 host=host, port=port, database=database, is_atlas=False)
        
        print("\n" + "="*70)
        print("✅ Your MongoDB URI (ready to use):")
        print("="*70)
        print(uri)
        print("\nAdd this to your backend/.env file as:")
        print(f"MONGO_URI={uri}")
        print()
        
    elif choice == "3":
        print("\n" + "-"*70)
        print("Enter your existing MongoDB URI components:")
        print("(Leave blank if not applicable)")
        print()
        
        username = input("Username: ").strip() or None
        password = input("Password: ").strip() or None
        
        if username:
            print(f"\nEncoded username: {encode_uri_component(username)}")
        if password:
            print(f"Encoded password: {encode_uri_component(password)}")
            
        print("\nUse these encoded values when building your URI.")
        
    else:
        print("\n❌ Invalid choice. Please run the script again.")
        return
    
    print("\n" + "="*70)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nCancelled.")
    except Exception as e:
        print(f"\n❌ Error: {e}")




