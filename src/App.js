import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import OpenSeadragon from "openseadragon";
import "./App.css"

const GEOCODE_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const GEOCODE_DEBOUNCE_MS = 350;

// In-memory cache shared across renders/instances so repeated searches
// (e.g. re-typing the same city) don't re-hit the API.
const geocodeCache = new Map();

async function geocodeCity(query) {
  const cacheKey = query.trim().toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  const response = await axios.get(GEOCODE_ENDPOINT, {
    params: {
      q: query,
      format: "json",
      addressdetails: 1,
      limit: 8,
    },
  });

  const results = response.data.map((place) => {
    const address = place.address || {};
    const city =
      address.city || address.town || address.village || address.county || place.display_name.split(",")[0];
    const country = address.country || "";
    return {
      city,
      country,
      latitude: parseFloat(place.lat),
      longitude: parseFloat(place.lon),
      displayName: place.display_name,
    };
  });

  geocodeCache.set(cacheKey, results);
  return results;
}

function AstrologyChartGenerator() {
  const [entries, setEntries] = useState([]);
  const [isInputVisible, setIsInputVisible] = useState(true); // Track panel visibility
  const [chartData, setChartData] = useState({
    date: "",
    time: "",
    latitude: "",
    longitude: "",
    city: "",
    country: ""
  });
  const [imageData, setImageData] = useState(null);
  const [imageBlob, setImageBlob] = useState(null);
  const viewerRef = useRef(null);
  const osdViewer = useRef(null); // Track OpenSeadragon instance
  
  // State for city autocomplete
  const [cityInput, setCityInput] = useState("");
  const [cityOptions, setCityOptions] = useState([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [cityHighlightIndex, setCityHighlightIndex] = useState(0);
  const [isCityLoading, setIsCityLoading] = useState(false);
  
  // Refs for input fields
  const dateInputRef = useRef(null);
  const timeInputRef = useRef(null);
  const latitudeInputRef = useRef(null);
  const longitudeInputRef = useRef(null);
  const cityInputRef = useRef(null);
  const generateButtonRef = useRef(null);
  
  // Initialize OpenSeadragon viewer once
  useEffect(() => {

    const timer = setTimeout(() =>{
    if (viewerRef.current && !osdViewer.current) {
      try {
        osdViewer.current = OpenSeadragon({
          id: "chart-viewer",
          prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
          showNavigator: true,
          navigatorPosition: "TOP_RIGHT", // Positions the navigator
          navigatorSizeRatio: 0.2, // Adjusts the size of the navigator
          navigatorAutoFade: true,
          zoomInButton: "zoom-in",
          zoomOutButton: "zoom-out",
          homeButton: "reset",
          // debugMode: true  // Add this to see more detailed logs
        });
      } catch (error) {
        console.error("Error initializing OpenSeadragon viewer:", error);
      }
    }
  }, 100);
    
    return () => {
      clearTimeout(timer);
      if (osdViewer.current) {
        osdViewer.current.destroy();
        osdViewer.current = null;
      }
    };
  }, []);

  // Update the tile source when the image changes
    useEffect(() => {
    if (imageData && osdViewer.current) {
      // Add a console log to debug
      console.log("Loading image into OSD:", imageData);
      
      // Force cleanup of any previous image
      if (osdViewer.current.world && osdViewer.current.world.getItemCount() > 0) {
        osdViewer.current.world.removeAll();
      }
      
      // Try with a timeout to ensure viewer is ready
      setTimeout(() => {
        osdViewer.current.open({
          type: "image",
          url: imageData
        });
      }, 100);
    }
  }, [imageData]);
  
  // Look up city options from the geocoding API as the user types, debounced
  // so we don't fire a request on every keystroke.
  useEffect(() => {
    const query = cityInput.trim();
    if (query.length < 3) {
      setCityOptions([]);
      setShowCityDropdown(false);
      setIsCityLoading(false);
      return;
    }

    let cancelled = false;
    setIsCityLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await geocodeCity(query);
        if (cancelled) return;
        setCityOptions(results);
        setShowCityDropdown(results.length > 0);
        setCityHighlightIndex(0);
      } catch (error) {
        if (!cancelled) {
          console.error("Error looking up city:", error);
          setCityOptions([]);
          setShowCityDropdown(false);
        }
      } finally {
        if (!cancelled) setIsCityLoading(false);
      }
    }, GEOCODE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cityInput]);
  
  // Handle clicks outside of dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      const cityContainer = document.getElementById("city-dropdown-container");
      
      if (cityContainer && !cityContainer.contains(event.target)) {
        setShowCityDropdown(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle city selection from dropdown
  const handleCitySelect = (cityData) => {
    setChartData({
      ...chartData,
      city: cityData.city,
      country: cityData.country,
      latitude: cityData.latitude.toString(),
      longitude: cityData.longitude.toString()
    });
    setCityInput(`${cityData.city}, ${cityData.country}`);
    setShowCityDropdown(false);
  };

  // Handle manual input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setChartData({
      ...chartData,
      [name]: value
    });
  };

  // Reset form to initial state
  const resetForm = () => {
    setChartData({
      date: "",
      time: "",
      latitude: "",
      longitude: "",
      city: "",
      country: ""
    });
    setCityInput("");
  };

  // Validate input before submitting
  const validateInput = () => {
    const { date, time, latitude, longitude } = chartData;
    
    // Check if date is provided
    if (!date) {
      alert("Please enter a date");
      return false;
    }
    
    // Check if time is provided
    if (!time) {
      alert("Please enter a time");
      return false;
    }
    
    // Check if either coordinates OR city is provided
    if ((!latitude || !longitude) && !cityInput) {
      alert("Please provide either coordinates (latitude and longitude) or a city name");
      return false;
    }
    
    // If latitude/longitude are provided, validate their format
    if (latitude || longitude) {
      if (isNaN(parseFloat(latitude)) || isNaN(parseFloat(longitude))) {
        alert("Latitude and longitude must be valid numbers");
        return false;
      }
      
      if (parseFloat(latitude) < -90 || parseFloat(latitude) > 90) {
        alert("Latitude must be between -90 and 90 degrees");
        return false;
      }
      
      if (parseFloat(longitude) < -180 || parseFloat(longitude) > 180) {
        alert("Longitude must be between -180 and 180 degrees");
        return false;
      }
    }
    
    return true;
  };

  // Properly implemented cyclical field navigation
  const focusNextField = (currentField) => {
    switch (currentField) {
      case 'date':
        timeInputRef.current.focus();
        break;
      case 'time':
        cityInputRef.current.focus();
        break;
      case 'city':
        latitudeInputRef.current.focus();
        break;
      case 'latitude':
        longitudeInputRef.current.focus();
        break;
      case 'longitude':
        generateButtonRef.current.focus();
        break;
      default:
        dateInputRef.current.focus();
    }
  };

  // Properly implemented cyclical field navigation in reverse
  const focusPreviousField = (currentField) => {
    switch (currentField) {
      case 'date':
        longitudeInputRef.current.focus();
        break;
      case 'time':
        dateInputRef.current.focus();
        break;
      case 'city':
        timeInputRef.current.focus();
        break;
      case 'latitude':
        cityInputRef.current.focus();
        break;
      case 'longitude':
        latitudeInputRef.current.focus();
        break;
      default:
        dateInputRef.current.focus();
    }
  };

  // Handle keyboard navigation for city input
  const handleCityKeyDown = (e) => {
    if (e.key === 'ArrowDown' && showCityDropdown) {
      e.preventDefault();
      setCityHighlightIndex((prevIndex) => 
        prevIndex < cityOptions.length - 1 ? prevIndex + 1 : prevIndex
      );
    } else if (e.key === 'ArrowUp' && showCityDropdown) {
      e.preventDefault();
      setCityHighlightIndex((prevIndex) => 
        prevIndex > 0 ? prevIndex - 1 : 0
      );
    } else if (e.key === 'Enter' && showCityDropdown) {
      e.preventDefault();
      if (cityOptions.length > 0) {
        handleCitySelect(cityOptions[cityHighlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowCityDropdown(false);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusNextField('city');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusPreviousField('city');
    } else if (e.key === 'Enter' && !showCityDropdown) {
      e.preventDefault();
      focusNextField('city');
    } else if (e.key === 'Tab') {
      if (showCityDropdown && cityOptions.length > 0) {
        e.preventDefault();
        handleCitySelect(cityOptions[cityHighlightIndex]);
        if (e.shiftKey) {
          focusPreviousField('city');
        } else {
          focusNextField('city');
        }
      }
    }
  };

  // Handle keyboard navigation for other inputs
  const handleKeyDown = (e, field) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusNextField(field);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusPreviousField(field);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'longitude') {
        if (validateInput()) {
          generateChart();
        }
      } else {
        focusNextField(field);
      }
    }
  };

  const resetEntries = () => {
    setEntries([]);
    // Clear image states and revoke any object URLs to prevent memory leaks
    if (imageData) {
      URL.revokeObjectURL(imageData);
      setImageData(null);
    }
    setImageBlob(null);

    // Reset form fields
    resetForm();

    // Reset OpenSeadragon viewer if it exists
    if (osdViewer.current) {
      osdViewer.current.world.removeAll();
      osdViewer.current.viewport.goHome(true);
    }

    // Focus on the first input field
    dateInputRef.current.focus();
};

  const generateChart = async () => {
    if (!validateInput()) return;
    
    try {
      // Prepare the payload, ensuring it has all necessary data
      const payload = {
        date: chartData.date,
        time: chartData.time,
        latitude: chartData.latitude,
        longitude: chartData.longitude,
        city: chartData.city || cityInput.split(',')[0].trim(), // Use the input city name if no selection was made
        country: chartData.country || (cityInput.includes(',') ? cityInput.split(',')[1].trim() : ""),
        calculatePositions: true
      };
      
      const response = await axios.post("https://fastapi-astro-chart.onrender.com/generate_chart", payload, {
        headers: { "Content-Type": "application/json" },
        responseType: "blob",
      });

      const newImageBlob = new Blob([response.data], { type: "image/png" });
      const imageUrl = URL.createObjectURL(newImageBlob);
      setImageData(imageUrl);
      setImageBlob(newImageBlob);
      
      // Request the calculated positions to display them
      try {
        const positionsResponse = await axios.post("https://fastapi-astro-chart.onrender.com/get_positions", payload, {
          headers: { "Content-Type": "application/json" },
        });
        
        // Assuming backend returns calculated positions for planets
        setEntries(positionsResponse.data);
      } catch (error) {
        console.error("Error fetching planet positions:", error);
      }
    } catch (error) {
      console.error("Error generating chart:", error);
      alert("Failed to generate chart. Please check your inputs and try again.");
    }
  };

  const downloadImage = () => {
    if (!imageBlob) return;
    
    // Create a descriptive filename with location and date information
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const location = chartData.city || cityInput || `${chartData.latitude}-${chartData.longitude}`;
    const dateStr = chartData.date.replace(/-/g, "");
    const fileName = `astrology-chart-${location}-${dateStr}-${timestamp}.png`;
    
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

  // Format date as string for display
  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  // Get display location - city, country or coordinates
  const getDisplayLocation = () => {
    if (chartData.city && chartData.country) {
      return `${chartData.city}, ${chartData.country}`;
    } else if (chartData.city) {
      return chartData.city;
    } else if (cityInput) {
      return cityInput;
    } else if (chartData.latitude && chartData.longitude) {
      return `${chartData.latitude}°, ${chartData.longitude}°`;
    } else {
      return "Unknown location";
    }
  };

  return (
    <div className={`two-panel-container ${isInputVisible ? "open" : "collapsed"}`}>
      
      <div className="input-panel">
        <h2>Astrology Chart Generator</h2>
        {/* Toggle button that protrudes from the panel */}
      <button 
        className="panel-toggle-button" 
        onClick={() => setIsInputVisible(false)}
        aria-label="Hide input panel"
      >
        &lt;&lt;
      </button>
        <div className="input-class">
          <div>
            <label>Date: </label>
            <input
              type="date"
              name="date"
              value={chartData.date}
              onChange={handleInputChange}
              onKeyDown={(e) => handleKeyDown(e, 'date')}
              ref={dateInputRef}
              style={{ width: "100%" }}
              required
            />
          </div>

          <div>
            <label>Time (12-hour format): </label>
            <input
              type="time"
              name="time"
              value={chartData.time}
              onChange={handleInputChange}
              onKeyDown={(e) => handleKeyDown(e, 'time')}
              ref={timeInputRef}
              style={{ width: "100%" }}
              step="1" // Allow seconds input
              required
            />
          </div>

          <div id="city-dropdown-container">
            <label style={{ display: "block", marginBottom: "4px" }}>City, Country: </label>
            <input
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              onKeyDown={handleCityKeyDown}
              onFocus={() => {
                if (cityInput.trim() !== '') {
                  setShowCityDropdown(true);
                }
              }}
              ref={cityInputRef}
              style={{ width: "100%" }}
              placeholder="Type to search for a city (min. 3 characters)"
            />
            {isCityLoading && (
              <div className="dropdown-menu">
                <div className="dropdown-option dropdown-loading">Searching...</div>
              </div>
            )}
            {!isCityLoading && showCityDropdown && cityOptions.length > 0 && (
              <div className="dropdown-menu">
                {cityOptions.map((cityData, index) => (
                  <div className="dropdown-option"
                    key={`${cityData.displayName}-${index}`}
                    onMouseEnter={() => setCityHighlightIndex(index)}
                    onClick={() => handleCitySelect(cityData)}
                  >
                    {cityData.displayName}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "4px" }}>Coordinates (optional if city selected):</label>
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <input
                  type="number"
                  name="latitude"
                  value={chartData.latitude}
                  onChange={handleInputChange}
                  onKeyDown={(e) => handleKeyDown(e, 'latitude')}
                  ref={latitudeInputRef}
                  style={{ width: "100%" }}
                  step="0.001"
                  min="-90"
                  max="90"
                  placeholder="Latitude (e.g. 40.7128)"
                />
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="number"
                  name="longitude"
                  value={chartData.longitude}
                  onChange={handleInputChange}
                  onKeyDown={(e) => handleKeyDown(e, 'longitude')}
                  ref={longitudeInputRef}
                  style={{ width: "100%" }}
                  step="0.001"
                  min="-180"
                  max="180"
                  placeholder="Longitude (e.g. -74.0060)"
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: "12px", display: "flex", gap: "10px", justifyContent: "center" }}>
            <button 
              onClick={generateChart}
              ref={generateButtonRef}
              style={{ 
                backgroundColor: "#4CAF50", 
                color: "white",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Generate Chart
            </button>
            
            <button 
              onClick={resetEntries}
              style={{ 
                backgroundColor: "#f44336", 
                color: "white",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Reset
            </button>
            
            <button 
              onClick={downloadImage} 
              disabled={!imageBlob} 
              style={{ 
                backgroundColor: imageBlob ? "#2196F3" : "#ccc", 
                color: "white",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: imageBlob ? "pointer" : "not-allowed"
              }}
            >
              Download as PNG
            </button>
          </div>
        </div>
      </div>

      <div className="results-panel">
        {/* Show button to bring back input panel (only visible when input is hidden) */}
        <button 
          className="show-input-button"
          onClick={() => setIsInputVisible(true)}
          aria-label="Show input panel"
        >
          &gt;&gt;
        </button>
        {/* Chart viewer container - 70% height */}
        <div className="chart-container">
          <h3>Chart for {getDisplayLocation()}, {formatDate(chartData.date)} at {chartData.time}</h3>
          <div id="chart-viewer" ref={viewerRef}></div>
          <div className="chart-controls">
            <button id="zoom-in">Zoom In</button>
            <button id="zoom-out">Zoom Out</button>
            <button id="reset">Reset</button>
          </div>
        </div>

        {/* Planet positions - 30% height */}
        {entries.length > 0 && (
          <div className="planet-positions">
            <h3>Calculated Planetary Positions</h3>
            <div className="planet-grid">
              {entries.map((entry, index) => (
                <div key={index} className="planet-card">
                  <strong>{entry.name}</strong>: {entry.sign} {entry.degree.toFixed(2)}°
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AstrologyChartGenerator;
