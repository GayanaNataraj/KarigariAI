import { useRef, useState } from "react";
import "./App.css";

function App() {
  const [screen, setScreen] = useState("home");
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const [language, setLanguage] = useState("");
  const [localText, setLocalText] = useState("");
  const [englishText, setEnglishText] = useState("");
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [product, setProduct] = useState({
    name: "",
    category: "",
    material: "",
    description: "",
    price: "",
    image: "",
    seller: "Demo Artisan",
  });

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const browseInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // =========================
  // IMAGE UPLOAD
  // =========================

  const handleImage = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    const imageURL = URL.createObjectURL(file);

    setImage(imageURL);
    setImageFile(file);

    setProduct((previous) => ({
      ...previous,
      image: imageURL,
    }));
  };

  // =========================
  // VOICE INPUT
  // =========================

  const startListening = () => {
    if (!language) {
      alert("Please select a language before using the microphone.");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Speech recognition is not supported in this browser. Please use Google Chrome."
      );
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();

    const languageCodes = {
      Kannada: "kn-IN",
      Hindi: "hi-IN",
      Telugu: "te-IN",
      Tamil: "ta-IN",
      English: "en-IN",
    };

    recognition.lang = languageCodes[language];
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }

      if (transcript.trim()) {
        setLocalText((previous) => {
          if (previous.trim()) {
            return `${previous} ${transcript.trim()}`;
          }

          return transcript.trim();
        });
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);

      setListening(false);

      if (event.error === "not-allowed") {
        alert(
          "Microphone permission was denied. Please allow microphone access in Chrome."
        );
      } else if (event.error === "no-speech") {
        alert("No speech was detected. Please try speaking again.");
      } else {
        alert("Voice recognition failed. Please try again.");
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error("Could not start speech recognition:", error);
      setListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    setListening(false);
  };

  // =========================
  // CLEAR VOICE
  // =========================

  const clearVoice = () => {
    stopListening();

    setLocalText("");
    setEnglishText("");

    setProduct((previous) => ({
      ...previous,
      description: "",
    }));
  };

  // =========================
  // TRANSLATION
  // =========================

  const translateToEnglish = async () => {
    if (!localText.trim()) {
      alert("Please speak or enter your product description first.");
      return;
    }

    if (!language) {
      alert("Please select a language first.");
      return;
    }

    try {
      const response = await fetch(
  `${import.meta.env.VITE_API_URL}/api/analyze-product`,
  {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: localText.trim(),
          sourceLanguage: language,
          targetLanguage: "English",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Translation service failed."
        );
      }

      const translation = data.translation?.trim();

      if (!translation) {
        throw new Error("No translation was returned.");
      }

      setEnglishText(translation);

      // Automatically place English translation
      // inside the existing Description field.
      setProduct((previous) => ({
        ...previous,
        description: translation,
      }));
    } catch (error) {
      console.error("Translation error:", error);

      alert(
        error.message ||
          "Translation service failed. Please try again."
      );
    }
  };

  // =========================
  // AI PRODUCT LISTING
  // =========================

  const generateListing = async () => {
    if (!imageFile) {
      alert("Please upload a product photo first.");
      return;
    }

    setProcessing(true);

    try {
      const formData = new FormData();

      formData.append("image", imageFile);

      formData.append(
        "description",
        product.description || ""
      );

      const response = await fetch(
        "/api/analyze-product",
        {
          method: "POST",
          body: formData,
        }
      );

      const contentType =
        response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const responseText = await response.text();

        console.error(
          "Non-JSON response from server:",
          responseText
        );

        throw new Error(
          "The AI server returned an invalid response. Please make sure the backend is running on port 3001."
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "AI product analysis failed."
        );
      }

      if (!data.listing) {
        throw new Error(
          "AI did not return a product listing."
        );
      }

      const listing = data.listing;

      setProduct({
        name: listing.name || "",
        category: listing.category || "",
        material: listing.material || "",
        description:
          listing.description ||
          product.description ||
          "",
        price: listing.suggestedPrice || "",
        image: listing.image || image,
        seller: listing.seller || "Demo Artisan",
      });

      if (listing.image) {
        setImage(listing.image);
      }

      setScreen("result");
    } catch (error) {
      console.error(
        "AI listing error:",
        error
      );

      alert(
        error.message ||
          "AI product analysis failed. Please try again."
      );
    } finally {
      setProcessing(false);
    }
  };

  // =========================
  // HOME SCREEN
  // =========================

  const HomeScreen = () => (
    <div className="screen">
      <div className="brand">
        <div className="logo">🧶</div>

        <div>
          <h1>Karigari AI</h1>
          <p>Crafts • Culture • Commerce</p>
        </div>
      </div>

      <div className="hero-card">
        <div className="hero-icon">🎨</div>

        <h2>
          Turn your craft into an online listing
        </h2>

        <p>
          Upload your handmade product and create
          a market-ready listing with AI.
        </p>

        <button
          className="primary-button"
          onClick={() => setScreen("upload")}
        >
          📷 Upload Product
        </button>
      </div>

      <div className="feature-row">
        <div className="feature-card">
          <span>🤖</span>
          <strong>AI Listing</strong>
          <small>Smart product details</small>
        </div>

        <div className="feature-card">
          <span>🎙️</span>
          <strong>Voice</strong>
          <small>Speak in your language</small>
        </div>

        <div className="feature-card">
          <span>🛍️</span>
          <strong>Catalogue</strong>
          <small>Showcase your crafts</small>
        </div>
      </div>

      <button
        className="secondary-button"
        onClick={() => setScreen("catalogue")}
      >
        View My Catalogue
      </button>
    </div>
  );

  // =========================
  // UPLOAD SCREEN
  // =========================

  const UploadScreen = () => (
    <div className="screen">
      <button
        className="back-button"
        onClick={() => setScreen("home")}
      >
        ← Back
      </button>

      <h2 className="page-title">
        Upload Your Product
      </h2>

      <p className="page-subtitle">
        Add a photo and describe your handmade product.
      </p>

      <div className="upload-box">
        {image ? (
          <img
            src={image}
            alt="Uploaded product"
            className="preview-image"
          />
        ) : (
          <>
            <div className="upload-icon">📷</div>

            <h3>Add Product Photo</h3>

            <p>
              Choose camera, gallery or browse files
            </p>
          </>
        )}

        <div className="upload-buttons">
          <button
            onClick={() =>
              cameraInputRef.current?.click()
            }
            className="upload-option"
          >
            📷 Camera
          </button>

          <button
            onClick={() =>
              galleryInputRef.current?.click()
            }
            className="upload-option"
          >
            🖼️ Gallery
          </button>

          <button
            onClick={() =>
              browseInputRef.current?.click()
            }
            className="upload-option"
          >
            📁 Browse
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImage}
          hidden
        />

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleImage}
          hidden
        />

        <input
          ref={browseInputRef}
          type="file"
          accept="image/*"
          onChange={handleImage}
          hidden
        />
      </div>

      {/* =========================
          VOICE + LANGUAGE
          ========================= */}

      <div className="voice-section">
        <label>Select Language</label>

        <select
          value={language}
          onChange={(event) =>
            setLanguage(event.target.value)
          }
        >
          <option value="">
            Select language
          </option>

          <option value="Kannada">
            Kannada
          </option>

          <option value="Hindi">
            Hindi
          </option>

          <option value="Telugu">
            Telugu
          </option>

          <option value="Tamil">
            Tamil
          </option>

          <option value="English">
            English
          </option>
        </select>

        <button
          className={`voice-button ${
            listening ? "listening" : ""
          }`}
          onClick={
            listening
              ? stopListening
              : startListening
          }
        >
          {listening
            ? "🔴 Listening... Click to Stop"
            : "🎙️ Speak About Your Product"}
        </button>

        <button
          className="clear-button"
          onClick={clearVoice}
        >
          Clear
        </button>
      </div>

      {/* ORIGINAL LANGUAGE */}

      <div className="text-section">
        <label>
          Original{" "}
          {language || "Local"} Language
        </label>

        <textarea
          value={localText}
          onChange={(event) =>
            setLocalText(event.target.value)
          }
          placeholder="Your spoken words will appear here..."
          rows="5"
        />
      </div>

      {/* TRANSLATE */}

      <button
        className="translate-button"
        onClick={translateToEnglish}
      >
        🌐 Translate to English
      </button>

      {/* ENGLISH TRANSLATION */}

      <div className="text-section">
        <label>English Translation</label>

        <textarea
          value={englishText}
          onChange={(event) => {
            const value = event.target.value;

            setEnglishText(value);

            setProduct((previous) => ({
              ...previous,
              description: value,
            }));
          }}
          placeholder="English translation will appear here..."
          rows="5"
        />
      </div>

      {/* DESCRIPTION */}

      <div className="text-section">
        <label>
          Describe your product (in your own words)
        </label>

        <textarea
          value={product.description}
          onChange={(event) =>
            setProduct((previous) => ({
              ...previous,
              description:
                event.target.value,
            }))
          }
          placeholder="Your English translation will automatically appear here..."
          rows="5"
        />
      </div>

      {/* GENERATE */}

      <button
        className="primary-button"
        onClick={generateListing}
        disabled={processing}
      >
        {processing
          ? "🤖 AI is analyzing..."
          : "✨ Generate Listing"}
      </button>
    </div>
  );

  // =========================
  // AI RESULT SCREEN
  // =========================

  const ResultScreen = () => (
    <div className="screen">
      <button
        className="back-button"
        onClick={() => setScreen("upload")}
      >
        ← Back
      </button>

      <h2 className="page-title">
        Your AI Listing
      </h2>

      {image && (
        <img
          src={image}
          alt="Product"
          className="result-image"
        />
      )}

      <div className="result-card">
        <label>Product Title</label>

        <input
          value={product.name}
          onChange={(e) =>
            setProduct({
              ...product,
              name: e.target.value,
            })
          }
          placeholder="AI product title"
        />

        <label>Category</label>

        <input
          value={product.category}
          onChange={(e) =>
            setProduct({
              ...product,
              category: e.target.value,
            })
          }
          placeholder="Product category"
        />

        <label>Material</label>

        <input
          value={product.material}
          onChange={(e) =>
            setProduct({
              ...product,
              material: e.target.value,
            })
          }
          placeholder="Product material"
        />

        <label>Description</label>

        <textarea
          value={product.description}
          onChange={(e) =>
            setProduct({
              ...product,
              description:
                e.target.value,
            })
          }
          rows="5"
        />

        <label>Suggested Price</label>

        <input
          value={product.price}
          onChange={(e) =>
            setProduct({
              ...product,
              price: e.target.value,
            })
          }
          placeholder="₹"
        />

        <label>Seller</label>

        <input
          value={product.seller}
          onChange={(e) =>
            setProduct({
              ...product,
              seller: e.target.value,
            })
          }
        />
      </div>

      <button
        className="primary-button"
        onClick={() =>
          setScreen("catalogue")
        }
      >
        🛍️ Add to Catalogue
      </button>
    </div>
  );

  // =========================
  // CATALOGUE SCREEN
  // =========================

  const CatalogueScreen = () => (
    <div className="screen">
      <button
        className="back-button"
        onClick={() => setScreen("home")}
      >
        ← Home
      </button>

      <h2 className="page-title">
        My Catalogue
      </h2>

      <p className="page-subtitle">
        Discover unique handcrafted products.
      </p>

      {image && (
        <div className="catalogue-card">
          <img
            src={image}
            alt={
              product.name ||
              "Product"
            }
          />

          <div>
            <h3>
              {product.name ||
                "My Handmade Product"}
            </h3>

            <p>
              {product.description ||
                "Handmade product created by a rural artisan."}
            </p>

            <strong>
              {product.price ||
                "₹450"}
            </strong>
          </div>
        </div>
      )}

      <div className="catalogue-card">
        <div className="dummy-image">
          🏺
        </div>

        <div>
          <h3>
            Handcrafted Terracotta Pot
          </h3>

          <p>
            Traditional handmade
            terracotta home decor.
          </p>

          <strong>₹899</strong>
        </div>
      </div>

      <div className="catalogue-card">
        <div className="dummy-image">
          🧺
        </div>

        <div>
          <h3>
            Traditional Handwoven Basket
          </h3>

          <p>
            Natural handcrafted basket
            made by artisans.
          </p>

          <strong>₹699</strong>
        </div>
      </div>

      <div className="catalogue-card">
        <div className="dummy-image">
          🪵
        </div>

        <div>
          <h3>
            Handmade Wooden Craft
          </h3>

          <p>
            Beautiful traditional
            wooden handicraft.
          </p>

          <strong>₹1,299</strong>
        </div>
      </div>
    </div>
  );

  // =========================
  // MAIN APP
  // =========================

  return (
    <main className="app">
      {screen === "home" && (
        <HomeScreen />
      )}

      {screen === "upload" && (
        <UploadScreen />
      )}

      {screen === "result" && (
        <ResultScreen />
      )}

      {screen === "catalogue" && (
        <CatalogueScreen />
      )}
    </main>
  );
}

export default App;
