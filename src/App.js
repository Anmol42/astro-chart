import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import OpenSeadragon from "openseadragon";
import "./App.css"


// Common cities with their latitude and longitude
const cityDatabase = [
  { city: "New York", country: "USA", latitude: 40.7128, longitude: -74.0060 },
  { city: "London", country: "UK", latitude: 51.5074, longitude: -0.1278 },
  { city: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 },
  { city: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503 },
  { city: "Sydney", country: "Australia", latitude: -33.8688, longitude: 151.2093 },
  { city: "Rio de Janeiro", country: "Brazil", latitude: -22.9068, longitude: -43.1729 },
  { city: "Cairo", country: "Egypt", latitude: 30.0444, longitude: 31.2357 },
  { city: "Mumbai", country: "India", latitude: 19.0760, longitude: 72.8777 },
  { city: "Beijing", country: "China", latitude: 39.9042, longitude: 116.4074 },
  { city: "Los Angeles", country: "USA", latitude: 34.0522, longitude: -118.2437 },
  { city: "Moscow", country: "Russia", latitude: 55.7558, longitude: 37.6173 },
  { city: "Berlin", country: "Germany", latitude: 52.5200, longitude: 13.4050 },
  { city: "Madrid", country: "Spain", latitude: 40.4168, longitude: -3.7038 },
  { city: "Toronto", country: "Canada", latitude: 43.6532, longitude: -79.3832 },
  { city: "Singapore", country: "Singapore", latitude: 1.3521, longitude: 103.8198 },
  { city: "Mexico City", country: "Mexico", latitude: 19.4326, longitude: -99.1332 },
  { city: "Cape Town", country: "South Africa", latitude: -33.9249, longitude: 18.4241 },
  { city: "Rome", country: "Italy", latitude: 41.9028, longitude: 12.4964 },
  { city: "Istanbul", country: "Turkey", latitude: 41.0082, longitude: 28.9784 },
  { city: "Dubai", country: "UAE", latitude: 25.2048, longitude: 55.2708 },
  { city: "Bangkok", country: "Thailand", latitude: 13.7563, longitude: 100.5018 },
  { city: "Amsterdam", country: "Netherlands", latitude: 52.3676, longitude: 4.9041 },
  { city: "Chicago", country: "USA", latitude: 41.8781, longitude: -87.6298 },
  { city: "San Francisco", country: "USA", latitude: 37.7749, longitude: -122.4194 },
  { city: "Stockholm", country: "Sweden", latitude: 59.3293, longitude: 18.0686 },
  { city: "Seoul", country: "South Korea", latitude: 37.5665, longitude: 126.9780 },
  { city: "Athens", country: "Greece", latitude: 37.9838, longitude: 23.7275 },
  { city: "Vienna", country: "Austria", latitude: 48.2082, longitude: 16.3738 },
  { city: "Prague", country: "Czech Republic", latitude: 50.0755, longitude: 14.4378 },
  { city: "Warsaw", country: "Poland", latitude: 52.2297, longitude: 21.0122 },
  { city: "Buenos Aires", country: "Argentina", latitude: -34.6037, longitude: -58.3816 },
  { city: "Santiago", country: "Chile", latitude: -33.4489, longitude: -70.6693 },
  { city: "Lima", country: "Peru", latitude: -12.0464, longitude: -77.0428 },
  { city: "Helsinki", country: "Finland", latitude: 60.1699, longitude: 24.9384 },
  { city: "Oslo", country: "Norway", latitude: 59.9139, longitude: 10.7522 },
  { city: "Copenhagen", country: "Denmark", latitude: 55.6761, longitude: 12.5683 },
  { city: "Dublin", country: "Ireland", latitude: 53.3498, longitude: -6.2603 },
  { city: "Brussels", country: "Belgium", latitude: 50.8503, longitude: 4.3517 },
  { city: "Lisbon", country: "Portugal", latitude: 38.7223, longitude: -9.1393 },
  { city: "Manila", country: "Philippines", latitude: 14.5995, longitude: 120.9842 },
  { city: "Kuala Lumpur", country: "Malaysia", latitude: 3.1390, longitude: 101.6869 },
  { city: "Jakarta", country: "Indonesia", latitude: -6.2088, longitude: 106.8456 },
  { city: "Auckland", country: "New Zealand", latitude: -36.8509, longitude: 174.7645 },
  { city: "Vancouver", country: "Canada", latitude: 49.2827, longitude: -123.1207 },
  { city: "Montreal", country: "Canada", latitude: 45.5017, longitude: -73.5673 },
  { city: "Nairobi", country: "Kenya", latitude: -1.2921, longitude: 36.8219 },
  { city: "Lagos", country: "Nigeria", latitude: 6.5244, longitude: 3.3792 },
  { city: "Johannesburg", country: "South Africa", latitude: -26.2041, longitude: 28.0473 },
  { city: "Riyadh", country: "Saudi Arabia", latitude: 24.7136, longitude: 46.6753 },
  { city: "Tel Aviv", country: "Israel", latitude: 32.0853, longitude: 34.7818 },
  { city: "Delhi", country: "India", latitude: 28.6139, longitude: 77.2090 },
  { city: "Bangalore", country: "India", latitude: 12.9716, longitude: 77.5946 },
  { city: "Hyderabad", country: "India", latitude: 17.3850, longitude: 78.4867 },
  { city: "Chennai", country: "India", latitude: 13.0827, longitude: 80.2707 },
  { city: "Kolkata", country: "India", latitude: 22.5726, longitude: 88.3639 },
  { city: "Ahmedabad", country: "India", latitude: 23.0225, longitude: 72.5714 },
  { city: "Pune", country: "India", latitude: 18.5204, longitude: 73.8567 },
  { city: "Jaipur", country: "India", latitude: 26.9124, longitude: 75.7873 },
  { city: "Surat", country: "India", latitude: 21.1702, longitude: 72.8311 },
  { city: "Lucknow", country: "India", latitude: 26.8467, longitude: 80.9462 },
  { city: "Kanpur", country: "India", latitude: 26.4499, longitude: 80.3319 },
  { city: "Nagpur", country: "India", latitude: 21.1458, longitude: 79.0882 },
  { city: "Indore", country: "India", latitude: 22.7196, longitude: 75.8577 },
  { city: "Thane", country: "India", latitude: 19.2183, longitude: 72.9781 },
  { city: "Bhopal", country: "India", latitude: 23.2599, longitude: 77.4126 },
  { city: "Visakhapatnam", country: "India", latitude: 17.6868, longitude: 83.2185 },
  { city: "Patna", country: "India", latitude: 25.5941, longitude: 85.1376 },
  { city: "Vadodara", country: "India", latitude: 22.3072, longitude: 73.1812 },
  { city: "Ghaziabad", country: "India", latitude: 28.6692, longitude: 77.4538 },
  { city: "Ludhiana", country: "India", latitude: 30.9010, longitude: 75.8573 },
  { city: "Agra", country: "India", latitude: 27.1767, longitude: 78.0081 },
  { city: "Nashik", country: "India", latitude: 19.9975, longitude: 73.7898 },
  { city: "Ranchi", country: "India", latitude: 23.3441, longitude: 85.3096 },
  { city: "Faridabad", country: "India", latitude: 28.4089, longitude: 77.3178 },
  { city: "Coimbatore", country: "India", latitude: 11.0168, longitude: 76.9558 },
  { city: "Jamshedpur", country: "India", latitude: 22.8046, longitude: 86.2029 },
  { city: "Srinagar", country: "India", latitude: 34.0837, longitude: 74.7973 },
  { city: "Aurangabad", country: "India", latitude: 19.8762, longitude: 75.3433 },
  { city: "Dhanbad", country: "India", latitude: 23.7957, longitude: 86.4304 },
  { city: "Amritsar", country: "India", latitude: 31.6340, longitude: 74.8723 },
  { city: "Navi Mumbai", country: "India", latitude: 19.0330, longitude: 73.0297 },
  { city: "Allahabad", country: "India", latitude: 25.4358, longitude: 81.8463 },
  { city: "Howrah", country: "India", latitude: 22.5958, longitude: 88.2636 },
  { city: "Guwahati", country: "India", latitude: 26.1445, longitude: 91.7362 },
  { city: "Chandigarh", country: "India", latitude: 30.7333, longitude: 76.7794 },
  { city: "Mysore", country: "India", latitude: 12.2958, longitude: 76.6394 },
  { city: "Gwalior", country: "India", latitude: 26.2183, longitude: 78.1828 },
  { city: "Jodhpur", country: "India", latitude: 26.2389, longitude: 73.0243 },
  { city: "Raipur", country: "India", latitude: 21.2514, longitude: 81.6296 },
  { city: "Kochi", country: "India", latitude: 9.9312, longitude: 76.2673 },
  { city: "Bhubaneswar", country: "India", latitude: 20.2961, longitude: 85.8245 },
  { city: "Bikaner", country: "India", latitude: 28.0229, longitude: 73.3119 },
  { city: "Bhilai", country: "India", latitude: 21.1938, longitude: 81.3509 },
  { city: "Puducherry", country: "India", latitude: 11.9139, longitude: 79.8145 },
  { city: "Dehradun", country: "India", latitude: 30.3165, longitude: 78.0322 },
  { city: "Salem", country: "India", latitude: 11.6643, longitude: 78.1460 },
  { city: "Ujjain", country: "India", latitude: 23.1765, longitude: 75.7885 },
  { city: "Jhansi", country: "India", latitude: 25.4484, longitude: 78.5685 },
  { city: "Thiruvananthapuram", country: "India", latitude: 8.5241, longitude: 76.9366 },
  { city: "Moradabad", country: "India", latitude: 28.8386, longitude: 78.7733 },
  { city: "Warangal", country: "India", latitude: 17.9689, longitude: 79.5941 },
  { city: "Jamnagar", country: "India", latitude: 22.4707, longitude: 70.0577 },
  { city: "Mangalore", country: "India", latitude: 12.9141, longitude: 74.8560 },
  { city: "Kota", country: "India", latitude: 25.2138, longitude: 75.8648 },
  { city: "Jalandhar", country: "India", latitude: 31.3260, longitude: 75.5762 },
  { city: "Gorakhpur", country: "India", latitude: 26.7605, longitude: 83.3731 },
  { city: "Ajmer", country: "India", latitude: 26.4499, longitude: 74.6399 },
  { city: "Udaipur", country: "India", latitude: 24.5854, longitude: 73.7125 },
  { city: "Tirupur", country: "India", latitude: 11.1085, longitude: 77.3411 },
  { city: "Siliguri", country: "India", latitude: 26.7271, longitude: 88.3953 },
  { city: "Guntur", country: "India", latitude: 16.3067, longitude: 80.4365 },
  { city: "Gurgaon", country: "India", latitude: 28.4595, longitude: 77.0266 },
  { city: "Aligarh", country: "India", latitude: 27.8974, longitude: 78.0880 },
  { city: "Jammu", country: "India", latitude: 32.7266, longitude: 74.8570 },
  { city: "Bareilly", country: "India", latitude: 28.3670, longitude: 79.4304 },
  { city: "Rajkot", country: "India", latitude: 22.3039, longitude: 70.8022 },
  { city: "Madurai", country: "India", latitude: 9.9252, longitude: 78.1198 },
  { city: "Tiruchchirappalli", country: "India", latitude: 10.7905, longitude: 78.7047 },
  { city: "Cochin", country: "India", latitude: 9.9312, longitude: 76.2673 },
  { city: "Vijayawada", country: "India", latitude: 16.5062, longitude: 80.6480 },
  { city: "Jabalpur", country: "India", latitude: 23.1815, longitude: 79.9864 },
  { city: "Noida", country: "India", latitude: 28.5355, longitude: 77.3910 },
  { city: "Varanasi", country: "India", latitude: 25.3176, longitude: 82.9739 },
  { city: "Meerut", country: "India", latitude: 28.9845, longitude: 77.7064 },
  { city: "Bhavnagar", country: "India", latitude: 21.7645, longitude: 72.1519 },
  { city: "Solapur", country: "India", latitude: 17.6599, longitude: 75.9064 },
  { city: "Thrissur", country: "India", latitude: 10.5276, longitude: 76.2144 },
  { city: "Hubli", country: "India", latitude: 15.3647, longitude: 75.1240 },
  { city: "Kolhapur", country: "India", latitude: 16.7050, longitude: 74.2433 },
  { city: "Cuttack", country: "India", latitude: 20.4625, longitude: 85.8830 },
  { city: "Firozabad", country: "India", latitude: 27.1592, longitude: 78.3957 },
  { city: "Amravati", country: "India", latitude: 20.9320, longitude: 77.7523 },
  { city: "Durgapur", country: "India", latitude: 23.5204, longitude: 87.3119 },
  { city: "Gandhinagar", country: "India", latitude: 23.2156, longitude: 72.6369 },
  { city: "Nellore", country: "India", latitude: 14.4426, longitude: 79.9865 },
  { city: "Rourkela", country: "India", latitude: 22.2604, longitude: 84.8536 },
  { city: "Muzaffarpur", country: "India", latitude: 26.1209, longitude: 85.3647 },
  { city: "Anantapur", country: "India", latitude: 14.6819, longitude: 77.6006 },
  { city: "Kozhikode", country: "India", latitude: 11.2588, longitude: 75.7804 },
  { city: "Erode", country: "India", latitude: 11.3410, longitude: 77.7172 },
  { city: "Haridwar", country: "India", latitude: 29.9457, longitude: 78.1642 },
  { city: "Mathura", country: "India", latitude: 27.4924, longitude: 77.6737 },
  { city: "Rohtak", country: "India", latitude: 28.8955, longitude: 76.6066 },
  { city: "Saharanpur", country: "India", latitude: 29.9680, longitude: 77.5510 },
  { city: "Raichur", country: "India", latitude: 16.2120, longitude: 77.3439 },
  { city: "Tirunelveli", country: "India", latitude: 8.7139, longitude: 77.7567 },
  { city: "Loni", country: "India", latitude: 28.7501, longitude: 77.2819 },
  { city: "Patiala", country: "India", latitude: 30.3398, longitude: 76.3869 },
  { city: "Belgaum", country: "India", latitude: 15.8497, longitude: 74.4977 },
  { city: "Kakinada", country: "India", latitude: 16.9891, longitude: 82.2475 }
];

function App() {
  const [entries, setEntries] = useState([]);
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
          zoomInButton: "zoom-in",
          zoomOutButton: "zoom-out",
          homeButton: "reset",
          debugMode: true  // Add this to see more detailed logs
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
  
  // Filter city options based on input
  useEffect(() => {
    if (cityInput.trim() === '') {
      setCityOptions([]);
      setShowCityDropdown(false);
    } else {
      const filteredCities = cityDatabase.filter(item => 
        item.city.toLowerCase().includes(cityInput.toLowerCase()) ||
        item.country.toLowerCase().includes(cityInput.toLowerCase())
      );
      setCityOptions(filteredCities);
      setShowCityDropdown(filteredCities.length > 0);
      setCityHighlightIndex(0);
    }
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
    setImageData(null);
    setImageBlob(null);
    resetForm();
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
    <div className="two-panel-container">
      
      <div className="input-panel">
        <h2>Astrology Chart Generator</h2>
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
              placeholder="Type to search for a city"
            />
            {showCityDropdown && cityOptions.length > 0 && (
              <div className="dropdown-menu">
                {cityOptions.map((cityData, index) => (
                  <div className="dropdown-option"
                    key={`${cityData.city}-${cityData.country}`}
                    onMouseEnter={() => setCityHighlightIndex(index)}
                    onClick={() => handleCitySelect(cityData)}
                  >
                    {cityData.city}, {cityData.country}
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
        {/* Chart viewer container - 70% height */}
        <div className="chart-container">
          <h3>Chart for {getDisplayLocation()}</h3>
          <p>{formatDate(chartData.date)} at {chartData.time}</p>
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

export default App;
