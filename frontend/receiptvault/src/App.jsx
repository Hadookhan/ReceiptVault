import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "https://d3pnxez72y4km9.cloudfront.net/api/upload-image"; // <-- your Flask API

const CATEGORIES = ["Groceries", "Shopping", "Transport"];

const SUBCATS = {
  Groceries: ["Supermarket", "Convenience", "Takeaway", "Bakery", "Other"],
  Shopping: ["Clothing", "Electronics", "Home", "Online", "Other"],
  Transport: ["Taxi/Rideshare", "Train", "Bus/Tram", "Fuel", "Other"],
};

const MERCHANT_TYPES = {
  Groceries: ["Lidl", "Tesco", "Asda", "Aldi", "Sainsbury's", "Morrisons", "Other"],
  Shopping: ["Amazon", "Primark", "IKEA", "Argos", "Other"],
  Transport: ["Uber", "Bolt", "TfL", "Trainline", "Other"],
};

const PAYMENT_METHODS = ["Cash", "Card", "Apple Pay / Google Pay", "Online", "Other"];

/**
 * Map backend department -> your UI categories
 * Backend returns: Grocery, Shopping, Dining, Utilities, Other
 */
function mapDepartmentToCategory(dept) {
  const d = (dept || "").toLowerCase();
  if (d === "grocery" || d === "groceries") return "Groceries";
  if (d === "shopping") return "Shopping";
  if (d === "dining") return "Groceries"; // or make a new UI category if you want
  if (d === "utilities") return "Shopping"; // best-effort mapping
  return "Shopping";
}

/**
 * Choose a dropdown value if it exists, else "Other"
 */
function pickOrOther(value, allowed) {
  if (!value) return allowed.includes("Other") ? "Other" : allowed[0];
  const v = String(value).trim().toLowerCase();
  const match = allowed.find((x) => x.toLowerCase() === v);
  return match || (allowed.includes("Other") ? "Other" : allowed[0]);
}

export default function App() {
  const [receipts, setReceipts] = useState([]);

  const [store, setStore] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Shopping");
  const [barcode, setBarcode] = useState("");

  const [subCategory, setSubCategory] = useState(SUBCATS["Shopping"][0]);
  const [merchantType, setMerchantType] = useState(MERCHANT_TYPES["Shopping"][0]);
  const [paymentMethod, setPaymentMethod] = useState("Card");

  const [receiptFile, setReceiptFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [apiStatus, setApiStatus] = useState("");

  // load/save receipts
  useEffect(() => {
    const saved = localStorage.getItem("receipts");
    if (saved) setReceipts(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("receipts", JSON.stringify(receipts));
  }, [receipts]);

  // preview image
  useEffect(() => {
    if (!receiptFile) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(receiptFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [receiptFile]);

  // keep dropdowns aligned when category changes
  useEffect(() => {
    setSubCategory(SUBCATS[category][0]);
    setMerchantType(MERCHANT_TYPES[category][0]);
  }, [category]);

  function resetForm() {
    setStore("");
    setAmount("");
    setBarcode("");
    setReceiptFile(null);
    setPreviewUrl("");
    setCategory("Shopping");
    setSubCategory(SUBCATS["Shopping"][0]);
    setMerchantType(MERCHANT_TYPES["Shopping"][0]);
    setPaymentMethod("Card");
  }

  function saveLocal(prefill = {}) {
    const finalBarcode = (prefill.barcode ?? barcode).trim();
    if (!finalBarcode) return alert("Receipt ID / Barcode required");

    const newReceipt = {
      id: Date.now(),
      store: (prefill.store ?? store).trim() || "Unknown store",
      amount: Number((prefill.amount ?? amount) ?? 0),
      category: prefill.category ?? category,
      barcode: finalBarcode,
      createdAt: new Date().toISOString(),
      subCategory: prefill.subCategory ?? subCategory,
      merchantType: prefill.merchantType ?? merchantType,
      paymentMethod: prefill.paymentMethod ?? paymentMethod,
      fileName: receiptFile?.name || "",
      previewUrl, // preview only
      // optional extras from API:
      items: prefill.items || undefined,
      extractedDate: prefill.date || undefined,
    };

    setReceipts([newReceipt, ...receipts]);
    setApiStatus("Saved locally ✅");
    resetForm();
  }

  /**
   * NEW: Call your Flask API, then auto-fill the form fields using the response.
   * Backend expects field name: receipt-img
   * Backend returns: store, price, date, category, id, items, raw...
   */
  async function extractAndAutofill() {
    if (!receiptFile) return alert("Upload a receipt photo first");
    setApiStatus("Extracting…");

    try {
      const form = new FormData();
      form.append("receipt-img", receiptFile); // <-- MUST match backend

      const res = await fetch(API_URL, { method: "POST", body: form });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `API ${res.status}`);
      }

      // Auto-fill fields
      const apiStore = payload.store || payload.raw?.merchant || "";
      const apiAmount =
        payload.price ??
        payload.raw?.total ??
        ""; // number
      const apiBarcode = payload.id || payload.raw?.id || "";
      const apiDate = payload.date || payload.raw?.date || "";
      const apiDept = payload.category || payload.raw?.department || payload.raw?.dept || "";
      const mappedCategory = mapDepartmentToCategory(apiDept);

      setStore(apiStore);
      setAmount(apiAmount === "" ? "" : String(apiAmount));
      setBarcode(apiBarcode);

      // set category first (this will trigger subcat/merchant reset via useEffect)
      setCategory(mappedCategory);

      // then pick best dropdown matches for merchantType based on store
      // (e.g. "TESCO" should map to "Tesco")
      const storeNormalized = String(apiStore || "").toLowerCase();
      const merchantPick = pickOrOther(
        storeNormalized.includes("tesco")
          ? "Tesco"
          : storeNormalized.includes("lidl")
          ? "Lidl"
          : storeNormalized.includes("asda")
          ? "Asda"
          : storeNormalized.includes("aldi")
          ? "Aldi"
          : storeNormalized.includes("sainsbury")
          ? "Sainsbury's"
          : storeNormalized.includes("morrisons")
          ? "Morrisons"
          : apiStore,
        MERCHANT_TYPES[mappedCategory]
      );

      setMerchantType(merchantPick);

      // keep your subCategory as first by default (or set to Other)
      setSubCategory(pickOrOther("Other", SUBCATS[mappedCategory]));

      // optional: show status
      setApiStatus(
        `Extracted ✅ ${apiStore || "Unknown"} • £${apiAmount || "—"} • ${apiDate || "—"}`
      );

      // If you want to auto-save immediately after autofill, uncomment:
      // saveLocal({
      //   store: apiStore,
      //   amount: apiAmount,
      //   barcode: apiBarcode,
      //   category: mappedCategory,
      //   subCategory: pickOrOther("Other", SUBCATS[mappedCategory]),
      //   merchantType: merchantPick,
      //   paymentMethod,
      //   date: apiDate,
      //   items: payload.items || payload.raw?.items || [],
      // });

      return payload;
    } catch (err) {
      setApiStatus(`Error ❌ ${err.message}`);
      return null;
    }
  }

  async function sendToApiAndSave() {
    const extracted = await extractAndAutofill();
    if (!extracted) return;

    const apiStore = extracted.store || extracted.raw?.merchant || "";
    const apiAmount = extracted.price ?? extracted.raw?.total ?? "";
    const apiBarcode = extracted.id || extracted.raw?.id || "";
    const apiDept = extracted.category || extracted.raw?.department || extracted.raw?.dept || "";
    const mappedCategory = mapDepartmentToCategory(apiDept);

    const storeNormalized = String(apiStore || "").toLowerCase();
    const merchantPick = pickOrOther(
      storeNormalized.includes("tesco")
        ? "Tesco"
        : storeNormalized.includes("lidl")
        ? "Lidl"
        : storeNormalized.includes("asda")
        ? "Asda"
        : storeNormalized.includes("aldi")
        ? "Aldi"
        : storeNormalized.includes("sainsbury")
        ? "Sainsbury's"
        : storeNormalized.includes("morrisons")
        ? "Morrisons"
        : apiStore,
      MERCHANT_TYPES[mappedCategory]
    );

    saveLocal({
      store: apiStore,
      amount: apiAmount,
      barcode: apiBarcode,
      category: mappedCategory,
      subCategory: pickOrOther("Other", SUBCATS[mappedCategory]),
      merchantType: merchantPick,
      paymentMethod,
      date: extracted.date,
      items: extracted.items || extracted.raw?.items || [],
    });
  }


  const kpis = useMemo(() => {
    const total = receipts.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const counts = receipts.reduce(
      (acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
      },
      { Groceries: 0, Shopping: 0, Transport: 0 }
    );
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    return { total, counts, top };
  }, [receipts]);

  return (
    <div className="app">
      <div className="header">
        <div className="brand">
          <div className="logo">🧾</div>
          <div>
            <h1>ReceiptVault</h1>
            <div className="subtitle">Save physical receipts for refunds</div>
          </div>
        </div>

        <div className="pillRow">
          <div className="pill">Hackathon Demo</div>
          <div className="pill soft">Secure upload</div>
        </div>
      </div>

      <div className="grid">
        {/* LEFT */}
        <div className="card">
          <div className="cardTitle">
            <h3>Add Receipt</h3>
            <div className="status">{apiStatus}</div>
          </div>

          <div
            className="uploadBox"
            onClick={() => document.getElementById("receiptUpload").click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && document.getElementById("receiptUpload").click()}
          >
            <input
              id="receiptUpload"
              className="hiddenFile"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            />

            {!receiptFile ? (
              <div>
                <div className="uploadTitle">Upload receipt photo</div>
                <div className="uploadSub">Click to choose an image</div>
              </div>
            ) : (
              <div className="uploadPicked">
                <div>
                  <div className="uploadTitle">{receiptFile.name}</div>
                  <div className="uploadSub">{Math.round(receiptFile.size / 1024)} KB</div>
                </div>

                <button
                  type="button"
                  className="ghostBtn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReceiptFile(null);
                    setPreviewUrl("");
                  }}
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {previewUrl && <img className="previewImg" src={previewUrl} alt="Receipt preview" />}

          <div className="btnRow" style={{ marginTop: 12 }}>
            <button onClick={extractAndAutofill} className="secondaryBtn" type="button">
              Extract (Auto-fill)
            </button>
            <button onClick={sendToApiAndSave} type="button">
              Upload + Save
            </button>
          </div>

          <div className="field">
            <label>Store</label>
            <input
              placeholder="e.g., Lidl, Uber, Amazon"
              value={store}
              onChange={(e) => setStore(e.target.value)}
            />
          </div>

          <div className="row2">
            <div className="field">
              <label>Total (£)</label>
              <input
                placeholder="e.g., 12.50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="row3">
            <div className="field">
              <label>Type</label>
              <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
                {SUBCATS[category].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Merchant</label>
              <select value={merchantType} onChange={(e) => setMerchantType(e.target.value)}>
                {MERCHANT_TYPES[category].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Payment</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Receipt ID / Barcode (required)</label>
            <input
              placeholder="e.g., ABC123456"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
            />
          </div>

          <div className="btnRow">
            <button onClick={() => saveLocal()} className="secondaryBtn" type="button">
              Save locally
            </button>
            <button onClick={sendToApiAndSave} type="button">
              Upload + Save
            </button>
          </div>

          <div className="hintSmall">(API URL is hidden in code for demo cleanliness)</div>
        </div>

        {/* RIGHT */}
        <div className="card">
          <div className="cardTitle">
            <h3>Saved Receipts</h3>
          </div>

          <div className="kpis">
            <div className="kpi">
              <div className="kpiLabel">Total saved</div>
              <div className="kpiValue">{receipts.length}</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel">Total spend</div>
              <div className="kpiValue">£{kpis.total.toFixed(2)}</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel">Top category</div>
              <div className="kpiValue">{kpis.top}</div>
            </div>
          </div>

          {receipts.length === 0 ? (
            <div className="empty">No receipts yet — add one on the left.</div>
          ) : (
            <div className="list">
              {receipts.map((r) => (
                <div key={r.id} className="receipt">
                  <div>
                    <strong>{r.store}</strong>
                    <div className="meta">
                      £{Number(r.amount || 0).toFixed(2)} • {new Date(r.createdAt).toLocaleString()}
                    </div>
                    <div className="meta">
                      {r.category} • {r.subCategory} • {r.merchantType} • {r.paymentMethod}
                    </div>
                    <div className="code">{r.barcode}</div>
                  </div>
                  <div className="badge">{r.category}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
