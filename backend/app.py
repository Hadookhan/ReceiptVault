from flask import Flask, request, jsonify
import json
import redis
from werkzeug.utils import secure_filename
import os
from model import extract_and_categorize

app = Flask(__name__)
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@app.get("/")
def root():
    return "Hello from Flask!"

@app.get("/api")
def home():
    return "Hello from Flask!"

@app.post("/api/upload-image")
def send_data():
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
    # Will return data that is captured from the image.
    print(data)

    store = data.get("merchant")
    price = data.get("total")
    date = data.get("date")
    cat = data.get("department")
    items = data.get("items", [])
    pur_id = data.get("id")

    if store is None or price is None or date is None:
        return jsonify({"error": "Missing required fields from extraction", "raw": data}), 400


    return jsonify({
        "message": "Data received successfully",
        "id": pur_id,
        "store": store,
        "price": price,
        "date": date,
        "category": cat,
        "items": items
    }), 200

@app.get("/api/health")
def health():
    return {"status": "ok"}

if __name__ == '__main__':
   app.run(
        host="0.0.0.0",
        port=5001,
        debug=True
   )