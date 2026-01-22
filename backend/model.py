import os
import json
import base64
from openai import OpenAI
from PIL import Image  # optional (only used if you want to verify/open)
from dotenv import load_dotenv


load_dotenv()
apikey = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=apikey)

def extract_and_categorize(image):

    # (Optional) sanity check that Pillow can open it
    Image.open(image).convert("RGB")

    # Read and base64-encode image for OpenAI
    with open(image, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    prompt = """
        Analyze the receipt image. Return ONLY valid JSON with:
        - merchant (string)
        - total (number)
        - date (YYYY-MM-DD)
        - department (Grocery, Shopping, Dining, Utilities, or Other)
        - items (list of {name, price})
        - id (the barcode id)
        If a field is unclear, use null. No extra text.
        """

    try:
        resp = client.responses.create(
            model="gpt-4o-mini",
            input=[
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt},
                        {
                            "type": "input_image",
                            "image_url": f"data:image/jpeg;base64,{b64}",
                        },
                    ],
                }
            ],
        )

        # The API returns a text output; parse as JSON
        text = resp.output_text
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"error": "Model returned non-JSON", "raw_text": text}


    except json.JSONDecodeError:
        print("Model didn't return valid JSON. Raw output:")
        print(resp.output_text if "resp" in locals() else "")
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None
