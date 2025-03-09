import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import OpenSeadragon from "openseadragon";

const signs = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const names = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu", "Uranus", "Neptune", "Pluto"];

function App() {
  const [entries, setEntries] = useState([]);
  const [selectedName, setSelectedName] = useState(names[0]);
  const [selectedSign, setSelectedSign] = useState(signs[0]);
  const [degree, setDegree] = useState("");
  const [imageData, setImageData] = useState(null);
  const [imageBlob, setImageBlob] = useState(null);
  const viewerRef = useRef(null);
  const osdViewer = useRef(null); // Track OpenSeadragon instance
  
  // State for autocomplete
  const [nameInput, setNameInput] = useState("");
  const [signInput, setSignInput] = useState("");
  const [nameOptions, setNameOptions] = useState(names);
  const [signOptions, setSignOptions] = useState(signs);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showSignDropdown, setShowSignDropdown] = useState(false);
  
  // State for keyboard navigation
  const [nameHighlightIndex, setNameHighlightIndex] = useState(0);
  const [signHighlightIndex, setSignHighlightIndex] = useState(0);
  
  // Refs for detecting clicks outside dropdowns
  const nameInputRef = useRef(null);
  const signInputRef = useRef(null);
  const degreeInputRef = useRef(null);
  const addButtonRef = useRef(null);
  
  // Initialize OpenSeadragon viewer once
  useEffect(() => {
    if (viewerRef.current && !osdViewer.current) {
      osdViewer.current = OpenSeadragon({
        id: "chart-viewer",
        prefixUrl: "https://openseadragon.github.io/openseadragon/images/", // Necessary for UI icons
        showNavigator: true,
        zoomInButton: "zoom-in",
        zoomOutButton: "zoom-out",
        homeButton: "reset",
      });
    }
    
    return () => {
      if (osdViewer.current) {
        osdViewer.current.destroy();
        osdViewer.current = null;
      }
    };
  }, []);

  // Update the tile source when the image changes
  useEffect(() => {
    if (imageData && osdViewer.current) {
      osdViewer.current.open({
        type: "image",
        url: imageData
      });
    }
  }, [imageData]);
  
  // Handle clicks outside of dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      // Check if the click is outside the dropdown containers
      const nameContainer = document.getElementById("name-dropdown-container");
      const signContainer = document.getElementById("sign-dropdown-container");
      
      if (nameContainer && !nameContainer.contains(event.target)) {
        setShowNameDropdown(false);
      }
      
      if (signContainer && !signContainer.contains(event.target)) {
        setShowSignDropdown(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter name options based on input
  useEffect(() => {
    if (nameInput.trim() === '') {
      setNameOptions(names);
    } else {
      const filtered = names.filter(name => 
        name.toLowerCase().includes(nameInput.toLowerCase())
      );
      setNameOptions(filtered);
    }
    // Reset highlight index when options change
    setNameHighlightIndex(0);
  }, [nameInput]);
  
  // Filter sign options based on input
  useEffect(() => {
    if (signInput.trim() === '') {
      setSignOptions(signs);
    } else {
      const filtered = signs.filter(sign => 
        sign.toLowerCase().includes(signInput.toLowerCase())
      );
      setSignOptions(filtered);
    }
    // Reset highlight index when options change
    setSignHighlightIndex(0);
  }, [signInput]);

  const handleNameSelect = (name) => {
    setSelectedName(name);
    setNameInput(name);
    setShowNameDropdown(false);
  };
  
  const handleSignSelect = (sign) => {
    setSelectedSign(sign);
    setSignInput(sign);
    setShowSignDropdown(false);
  };

  // Reset form to initial state
  const resetForm = () => {
    setSelectedName(names[0]);
    setSelectedSign(signs[0]);
    setNameInput("");
    setSignInput("");
    setDegree("");
  };

  // Properly implemented cyclical field navigation
  const focusNextField = (currentField) => {
    if (currentField === 'name') {
      signInputRef.current.focus();
    } else if (currentField === 'sign') {
      degreeInputRef.current.focus();
    } else if (currentField === 'degree') {
      nameInputRef.current.focus();
    }
  };

  // Properly implemented cyclical field navigation in reverse
  const focusPreviousField = (currentField) => {
    if (currentField === 'name') {
      degreeInputRef.current.focus();
    } else if (currentField === 'sign') {
      nameInputRef.current.focus();
    } else if (currentField === 'degree') {
      signInputRef.current.focus();
    }
  };

  // Handle tab completion and keyboard navigation for name input
  const handleNameKeyDown = (e) => {
    if (e.key === 'Tab' && showNameDropdown && nameOptions.length > 0) {
      e.preventDefault();
      handleNameSelect(nameOptions[nameHighlightIndex]);
      if (e.shiftKey) {
        // Focus previous element
        focusPreviousField('name');
      } else {
        focusNextField('name');
      }
    } else if (e.key === 'ArrowDown' && showNameDropdown) {
      e.preventDefault();
      setNameHighlightIndex((prevIndex) => 
        prevIndex < nameOptions.length - 1 ? prevIndex + 1 : prevIndex
      );
    } else if (e.key === 'ArrowUp' && showNameDropdown) {
      e.preventDefault();
      setNameHighlightIndex((prevIndex) => 
        prevIndex > 0 ? prevIndex - 1 : 0
      );
    } else if (e.key === 'Enter' && showNameDropdown) {
      e.preventDefault();
      if (nameOptions.length > 0) {
        handleNameSelect(nameOptions[nameHighlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowNameDropdown(false);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusNextField('name');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusPreviousField('name');
    } else if (e.key === 'Enter' && !showNameDropdown) {
      e.preventDefault();
      focusNextField('name');
    }
  };
  
  // Handle tab completion and keyboard navigation for sign input
  const handleSignKeyDown = (e) => {
    if (e.key === 'Tab' && showSignDropdown && signOptions.length > 0) {
      e.preventDefault();
      handleSignSelect(signOptions[signHighlightIndex]);
      if (e.shiftKey) {
        focusPreviousField('sign');
      } else {
        focusNextField('sign');
      }
    } else if (e.key === 'ArrowDown' && showSignDropdown) {
      e.preventDefault();
      setSignHighlightIndex((prevIndex) => 
        prevIndex < signOptions.length - 1 ? prevIndex + 1 : prevIndex
      );
    } else if (e.key === 'ArrowUp' && showSignDropdown) {
      e.preventDefault();
      setSignHighlightIndex((prevIndex) => 
        prevIndex > 0 ? prevIndex - 1 : 0
      );
    } else if (e.key === 'Enter' && showSignDropdown) {
      e.preventDefault();
      if (signOptions.length > 0) {
        handleSignSelect(signOptions[signHighlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSignDropdown(false);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusNextField('sign');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusPreviousField('sign');
    } else if (e.key === 'Enter' && !showSignDropdown) {
      e.preventDefault();
      focusNextField('sign');
    }
  };

  // Handle keyboard navigation for degree input
  const handleDegreeKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusNextField('degree');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusPreviousField('degree');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addEntry();
    }
  };

  const addEntry = () => {
    if (degree === "" || isNaN(parseFloat(degree))) return;
    
    // Get the final values - either from input or selected
    const finalName = nameInput || selectedName;
    const finalSign = signInput || selectedSign;
    
    // Validate that name and sign are in our lists
    if (!names.includes(finalName) || !signs.includes(finalSign)) {
      alert("Please select valid Name and Sign options");
      return;
    }
    
    setEntries([...entries, { 
      name: finalName, 
      sign: finalSign, 
      degree: parseFloat(degree) 
    }]);
    
    // Reset form to initial state
    resetForm();
    
    // Return focus to the name input for quick entry of multiple planets
    nameInputRef.current.focus();
  };

  const resetEntries = () => {
    setEntries([]);
    setImageData(null);
    setImageBlob(null);
    resetForm();
    nameInputRef.current.focus();
  };

  const generateChart = async () => {
    try {
      const response = await axios.post("https://fastapi-astro-chart.onrender.com/generate_chart", entries, {
        headers: { "Content-Type": "application/json" },
        responseType: "blob",
      });

      const newImageBlob = new Blob([response.data], { type: "image/png" });
      const imageUrl = URL.createObjectURL(newImageBlob);
      setImageData(imageUrl);
      setImageBlob(newImageBlob);
    } catch (error) {
      console.error("Error generating chart:", error);
    }
  };

  const downloadImage = () => {
    if (!imageBlob) return;
    
    // Create a timestamp for unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `astrology-chart-${timestamp}.png`;
    
    // Create download link
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(imageBlob);
    downloadLink.download = fileName;
    
    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    // Clean up
    document.body.removeChild(downloadLink);
  };

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h2>Astrology Chart Generator</h2>
      <div>
        <div id="name-dropdown-container" style={{ display: "inline-block", position: "relative", marginRight: "10px" }}>
          <label>Name: </label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setShowNameDropdown(true);
            }}
            onFocus={() => setShowNameDropdown(true)}
            onKeyDown={handleNameKeyDown}
            ref={nameInputRef}
            style={{ width: "100px" }}
            placeholder={selectedName}
          />
          {showNameDropdown && nameOptions.length > 0 && (
            <div 
              style={{
                position: "absolute",
                left: 0,
                zIndex: 1,
                background: "white",
                border: "1px solid #ccc",
                width: "150px",
                maxHeight: "200px",
                overflowY: "auto",
                textAlign: "left"
              }}
            >
              {nameOptions.map((name, index) => (
                <div
                  key={name}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    backgroundColor: index === nameHighlightIndex ? "#e0e0e0" : (name === selectedName ? "#f0f0f0" : "white")
                  }}
                  onMouseEnter={() => setNameHighlightIndex(index)}
                  // Direct inline function to handle click
                  onClick={() => {
                    handleNameSelect(name);
                  }}
                >
                  {name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div id="sign-dropdown-container" style={{ display: "inline-block", position: "relative", marginRight: "10px" }}>
          <label>Sign: </label>
          <input
            type="text"
            value={signInput}
            onChange={(e) => {
              setSignInput(e.target.value);
              setShowSignDropdown(true);
            }}
            onFocus={() => setShowSignDropdown(true)}
            onKeyDown={handleSignKeyDown}
            ref={signInputRef}
            style={{ width: "100px" }}
            placeholder={selectedSign}
          />
          {showSignDropdown && signOptions.length > 0 && (
            <div 
              style={{
                position: "absolute",
                left: 0,
                zIndex: 1,
                background: "white",
                border: "1px solid #ccc",
                width: "150px",
                maxHeight: "200px",
                overflowY: "auto",
                textAlign: "left"
              }}
            >
              {signOptions.map((sign, index) => (
                <div
                  key={sign}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    backgroundColor: index === signHighlightIndex ? "#e0e0e0" : (sign === selectedSign ? "#f0f0f0" : "white")
                  }}
                  onMouseEnter={() => setSignHighlightIndex(index)}
                  // Direct inline function to handle click
                  onClick={() => {
                    handleSignSelect(sign);
                  }}
                >
                  {sign}
                </div>
              ))}
            </div>
          )}
        </div>

        <label style={{ marginLeft: "10px" }}>Degree: </label>
        <input 
          type="number" 
          value={degree} 
          onChange={(e) => setDegree(e.target.value)} 
          style={{ width: "60px" }}
          ref={degreeInputRef}
          onKeyDown={handleDegreeKeyDown}
        />

        <button 
          onClick={addEntry} 
          style={{ marginLeft: "10px" }}
          ref={addButtonRef}
        >
          Add
        </button>
        <button onClick={resetEntries} style={{ marginLeft: "10px" }}>Reset</button>
      </div>

      <div style={{ marginTop: "20px" }}>
        <h3>Entries</h3>
        {entries.length > 0 ? (
          <ul>
            {entries.map((entry, index) => (
              <li key={index}>{entry.name} in {entry.sign} at {entry.degree}°</li>
            ))}
          </ul>
        ) : (
          <p>No entries added yet</p>
        )}
      </div>

      <button 
        onClick={generateChart} 
        disabled={entries.length === 0} 
        style={{ 
          marginRight: "10px",
          backgroundColor: entries.length > 0 ? "#4CAF50" : "#ccc", 
          color: "white",
          padding: "8px 16px",
          border: "none",
          borderRadius: "4px",
          cursor: entries.length > 0 ? "pointer" : "not-allowed"
        }}
      >
        Generate Chart
      </button>
      
      <button 
        onClick={downloadImage} 
        disabled={!imageBlob} 
        style={{ 
          backgroundColor: imageBlob ? "#4CAF50" : "#ccc", 
          color: "white",
          padding: "8px 16px",
          border: "none",
          borderRadius: "4px",
          cursor: imageBlob ? "pointer" : "not-allowed"
        }}
      >
        Download as PNG
      </button>

      {/* Chart viewer container - always render it but hide when no image */}
      <div style={{ marginTop: "20px", display: imageData ? "block" : "none" }}>
        <h3>Generated Chart (Zoomable)</h3>
        <div id="chart-viewer" ref={viewerRef} style={{ width: "100%", height: "500px" }}></div>
        <div style={{ marginTop: "10px" }}>
          <button id="zoom-in" style={{ marginRight: "5px" }}>Zoom In</button>
          <button id="zoom-out" style={{ marginRight: "5px" }}>Zoom Out</button>
          <button id="reset">Reset</button>
        </div>
      </div>
    </div>
  );
}

export default App;