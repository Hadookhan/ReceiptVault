from flask import Flask, request, jsonify
import json
import redis
from werkzeug.utils import secure_filename
import os

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

    # Will return data that is captured from the image.


    store = ""
    price = ""
    date = ""
    pur_id =  ""
    cat = ""

    # Optional validation
    if not all([store, price, date, pur_id]):
        return jsonify({"error": "Missing required fields"}), 400

    return jsonify({
        "message": "Data received successfully",
        "store": store,
        "price": price,
        "date": date,
        "id": pur_id,
        "category": cat
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