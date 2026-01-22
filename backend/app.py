from flask import Flask, request, jsonify
from flask_cors import CORS  # ✅ NEW
import json
import redis
from werkzeug.utils import secure_filename
import os
from model import extract_and_categorize

app = Flask(__name__)

# ✅ Allow localhost dev origins (Vite/React common ports)
LOCALHOST_ORIGINS = [
    "http://localhost:5173",  # Vite default
    "http://127.0.0.1:5173",
    "http://localhost:3000",  # CRA
    "http://127.0.0.1:3000",
    "http://localhost:4173",  # Vite preview
    "http://127.0.0.1:4173",
]

# ✅ Enable CORS for API routes
CORS(
    app,
    resources={r"/api/*": {"origins": LOCALHOST_ORIGINS}},
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# ✅ Handle preflight quickly (optional but helps)
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        return ("", 204)

@app.get("/")
def root():
    return "Hello from Flask!"

@app.get("/api")
def home():
    return "Hello from Flask!"

# ✅ Add OPTIONS to this route explicitly
@app.route("/api/upload-image", methods=["POST", "OPTIONS"])
def send_data():
    if request.method == "OPTIONS":
        return ("", 204)

    if "receipt-img" not in request.files:
        return jsonify({"error": "No file field named 'receipt-img' in form-data"}), 400

    file = request.files["receipt-img"]

    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 415

    filename = secure_filename(file.filename)
    save_path = os.path.join(UPLOAD_DIR, filename)
    file.save(save_path)

    data = extract_and_categorize(save_path)

    if data is None:
        return jsonify({
            "error": "Extraction failed",
            "details": "extract_and_categorize returned None. Check /api/debug-last-error or docker logs."
        }), 502

    if isinstance(data, dict) and data.get("error"):
        return jsonify({
            "error": "Extraction failed",
            "details": data
        }), 502

    store = data.get("merchant")
    price = data.get("total")
    date = data.get("date")
    cat = data.get("department")
    items = data.get("items", [])
    pur_id = data.get("id")

    missing = [k for k, v in {"merchant": store, "total": price, "date": date}.items() if v in (None, "", [])]

    if store is None or price is None or date is None:
        return jsonify({"error": "Missing required fields from extraction", "raw": data}), 400

    return jsonify({
        "message": "Extraction successful" if not missing else "Partial extraction",
        "id": pur_id,
        "missing_fields": missing,
        "store": store,
        "price": price,
        "date": date,
        "category": cat,
        "items": items,
        "raw": data
    }), 200

@app.get("/api/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
