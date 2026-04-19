import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { Lock, Shield, CheckCircle, ArrowLeft, QrCode, Menu, X, History, Users, User, Settings, HelpCircle, LogOut, ChevronRight } from 'lucide-react';

const API_URL = "https://shortid-backend-production.up.railway.app";

const MobileApp = () => {
  const [screen, setScreen] = useState('login');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [sharePin, setSharePin] = useState('');
  const [userData, setUserData] = useState(null);
  const [scannedHotel, setScannedHotel] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFamilyMembers, setSelectedFamilyMembers] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  const simulatedUserData = {
    name: 'Rajesh Kumar',
    photo: null,
    address: 'H.No 245, Sector 21, Gurugram, Haryana - 122001',
    dob: '15/03/1990',
    gender: 'Male',
  };

  const familyMembers = [
    { name: 'Priya Kumar', relation: 'Spouse', dob: '20/05/1992', isMinor: false },
    { name: 'Aarav Kumar', relation: 'Son', dob: '15/08/2015', isMinor: true }
  ];


  // Cleanup camera on screen change
  useEffect(() => {
    if (screen !== 'scan-qr') {
      stopCamera();
    }
  }, [screen]);

  const startCamera = async () => {
    setCameraError('');
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        startScanning();
      }
    } catch (err) {
      setCameraError('Camera access denied. Please allow camera permission and try again.');
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setScanning(false);
  };

  const startScanning = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    scanIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;
      

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data) {
        stopCamera();
        handleQRResult(code.data);
      }
    }, 300);
  };

  const handleQRResult = (qrData) => {
    // QR code should contain hotel code like "HTL-XXXXXX"
    // or a JSON string like {"hotelCode":"HTL-XXXXXX","name":"Hotel Name","location":"..."}
    try {
      const parsed = JSON.parse(qrData);
      setScannedHotel({
        name: parsed.name || 'Hotel',
        location: parsed.location || '',
        code: parsed.hotelCode || parsed.code || qrData
      });
    } catch {
      // Plain text hotel code
      setScannedHotel({
        name: 'Hotel',
        location: '',
        code: qrData
      });
    }
    setScreen('confirm-share');
  };

  const handleLogin = () => {
    setErrorMessage('');
    if (phoneNumber.length !== 10) {
      setErrorMessage('Invalid number. Please enter a 10-digit phone number.');
      return;
    }
    setScreen('otp');
  };

  const handleOtpVerify = () => {
    if (otp.length === 6) {
      const existingUser = localStorage.getItem('userData');
      if (existingUser) {
        setUserData(JSON.parse(existingUser));
        setScreen('home');
      } else {
        setScreen('credential-issuer');
      }
    }
  };

  const handleFetchId = () => {
    setTimeout(() => {
      const data = { ...simulatedUserData, phone: phoneNumber };
      setUserData(data);
      localStorage.setItem('userData', JSON.stringify(data));
      setScreen('setup-pin');
    }, 1500);
  };

  const handleSetupPin = () => {
    setErrorMessage('');
    if (pin.length !== 4) { setErrorMessage('PIN must be 4 digits'); return; }
    if (pin !== confirmPin) { setErrorMessage('PINs do not match'); return; }
    localStorage.setItem('userPin', pin);
    setScreen('home');
  };

  const handleConfirmShare = async () => {
    setErrorMessage('');
    const savedPin = localStorage.getItem('userPin');
    if (sharePin !== savedPin) {
      setErrorMessage('Wrong PIN. Please try again.');
      return;
    }
    setSharing(true);
    try {
      const sidNumber = 'SID-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const res = await fetch(`${API_URL}/api/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelCode: scannedHotel.code,
          sidNumber,
          guestName: userData.name,
          guestPhone: userData.phone || phoneNumber,
          guestDOB: userData.dob,
          guestGender: userData.gender || 'Male',
          guestAddress: userData.address,
        })
      });
      const data = await res.json();
      if (data.success) {
        setScreen('success');
        setSharePin('');
        setErrorMessage('');
      } else {
        setErrorMessage(data.error || 'Share failed. Try again.');
      }
    } catch (e) {
      setErrorMessage('Network error: ' + e.message);
    }
    setSharing(false);
  };

  const toggleFamilyMember = (idx) => {
    if (selectedFamilyMembers.includes(idx)) {
      setSelectedFamilyMembers(selectedFamilyMembers.filter(i => i !== idx));
    } else {
      setSelectedFamilyMembers([...selectedFamilyMembers, idx]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* LOGIN */}
        {screen === 'login' && (
          <div className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-5xl font-bold">
                <span style={{color: '#002B5C'}}>Short</span>
                <span style={{color: '#3DB5E6'}}>ID</span>
              </h1>
              <p className="text-gray-500 mt-2">Your identity, minus the risk</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input type="tel" maxLength="10" placeholder="Enter 10 digit mobile number"
                  value={phoneNumber}
                  onChange={(e) => { setPhoneNumber(e.target.value.replace(/\D/g, '')); setErrorMessage(''); }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {errorMessage && <p className="text-red-600 text-sm mt-2">⚠️ {errorMessage}</p>}
              </div>
              <button onClick={handleLogin} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">
                Send OTP
              </button>
            </div>
          </div>
        )}

        {/* OTP */}
        {screen === 'otp' && (
          <div className="p-8">
            <button onClick={() => setScreen('login')} className="mb-4 text-indigo-600"><ArrowLeft className="w-6 h-6" /></button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Enter OTP</h2>
            <p className="text-gray-500 mb-6">We sent a code to +91 {phoneNumber}</p>
            <div className="space-y-4">
              <input type="text" maxLength="6" placeholder="Enter 6 digit OTP" value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl tracking-widest focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-sm text-gray-400 text-center">Demo: enter any 6 digits</p>
              <button onClick={handleOtpVerify} disabled={otp.length !== 6}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:bg-gray-300 transition">
                Verify OTP
              </button>
            </div>
          </div>
        )}

        {/* CREDENTIAL ISSUER */}
        {screen === 'credential-issuer' && (
          <div className="p-8">
            <button onClick={() => setScreen('otp')} className="mb-4 text-indigo-600"><ArrowLeft className="w-6 h-6" /></button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Add Your Credential</h2>
            <p className="text-gray-600 mb-8">Identity Credential Issuer</p>
            <div className="space-y-4">
              <button onClick={() => setScreen('fetch-id')}
                className="w-full bg-white border-2 border-gray-200 rounded-xl p-5 hover:border-indigo-400 transition flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-800">Continue with DigiLocker</span>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-8 h-8 text-purple-600" />
                </div>
              </button>
              <button onClick={() => setScreen('fetch-id')}
                className="w-full bg-white border-2 border-gray-200 rounded-xl p-5 hover:border-indigo-400 transition flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-800">Continue with Direct AADHAAR</span>
                <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
                  <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" fill="#FF6B00"/>
                    <circle cx="20" cy="20" r="14" fill="#FFB800"/>
                    <circle cx="20" cy="20" r="10" fill="#FF0000"/>
                    <circle cx="20" cy="20" r="6" fill="#8B0000"/>
                  </svg>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* FETCH ID */}
        {screen === 'fetch-id' && (
          <div className="p-8">
            <button onClick={() => setScreen('credential-issuer')} className="mb-4 text-indigo-600"><ArrowLeft className="w-6 h-6" /></button>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Shield className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Create ID Credentials</h2>
              <p className="text-gray-500">We'll securely fetch your details</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>What we fetch:</strong><br/>
                • Your Name • Your Photo<br/>
                • Your Address • Date of Birth<br/><br/>
                <strong>We DO NOT store your Aadhaar number</strong>
              </p>
            </div>
            <button onClick={handleFetchId} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">
              Fetch My ID Details
            </button>
          </div>
        )}

        {/* SETUP PIN */}
        {screen === 'setup-pin' && (
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Lock className="w-10 h-10 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Setup Secure PIN</h2>
              <p className="text-gray-500">This PIN will be required before sharing your ID</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter 4-digit PIN</label>
                <input type="password" maxLength="4" placeholder="••••" value={pin}
                  onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setErrorMessage(''); }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl tracking-widest focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm PIN</label>
                <input type="password" maxLength="4" placeholder="••••" value={confirmPin}
                  onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '')); setErrorMessage(''); }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl tracking-widest focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {errorMessage && <p className="text-red-600 text-sm">⚠️ {errorMessage}</p>}
              <button onClick={handleSetupPin} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">
                Setup PIN
              </button>
            </div>
          </div>
        )}

        {/* HOME */}
        {screen === 'home' && userData && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">My Digital ID</h2>
              <button onClick={() => setScreen('menu')} className="p-2 hover:bg-gray-100 rounded-lg">
                <Menu className="w-6 h-6 text-gray-700" />
              </button>
            </div>
            <div className="bg-white border-4 border-black rounded-3xl p-6 mb-6 shadow-lg">
              <div className="flex justify-center mb-4">
                <div className="w-40 h-40 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <span className="text-5xl font-bold text-indigo-600">{userData.name.split(' ').map(n=>n[0]).join('')}</span>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-center text-gray-900 mb-1">{userData.name}</h3>
              <p className="text-center text-gray-600 mb-1">{userData.gender || 'Male'}</p>
              <p className="text-center text-gray-900 font-medium text-lg mb-4">{userData.dob}</p>
              <div className="mb-6">
                <p className="text-gray-900 text-center leading-relaxed">
                  <span className="font-semibold">Address: </span>{userData.address}
                </p>
              </div>
              <div className="flex items-end justify-between">
                <div className="w-32 h-32 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center">
                  <QrCode className="w-20 h-20 text-indigo-600" />
                </div>
                <div className="flex items-center bg-purple-600 text-white px-3 py-2 rounded-lg text-xs font-semibold">
                  <Shield className="w-4 h-4 mr-1" />
                  <span>DIGILOCKER<br/>VERIFIED</span>
                </div>
              </div>
            </div>
            <button onClick={() => setScreen('scan-qr')}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center justify-center space-x-2 mb-3">
              <QrCode className="w-6 h-6" />
              <span>Scan Hotel QR Code</span>
            </button>
            {familyMembers.length > 0 && (
              <button onClick={() => setScreen('select-family-share')}
                className="w-full bg-white border-2 border-indigo-600 text-indigo-600 py-4 rounded-xl font-semibold hover:bg-indigo-50 transition flex items-center justify-center space-x-2">
                <Users className="w-6 h-6" />
                <span>Share with Family IDs</span>
              </button>
            )}
          </div>
        )}

        {/* MENU */}
        {screen === 'menu' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Menu</h2>
              <button onClick={() => setScreen('home')} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-6 h-6 text-gray-700" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { icon: <History className="w-5 h-5 text-blue-600"/>, bg: 'bg-blue-100', label: 'Share History' },
                { icon: <Users className="w-5 h-5 text-green-600"/>, bg: 'bg-green-100', label: 'Family & Minors', action: () => setScreen('select-family-share') },
                { icon: <Settings className="w-5 h-5 text-purple-600"/>, bg: 'bg-purple-100', label: 'Settings' },
                { icon: <HelpCircle className="w-5 h-5 text-orange-600"/>, bg: 'bg-orange-100', label: 'Help & Support' },
              ].map(({ icon, bg, label, action }) => (
                <button key={label} onClick={action || undefined}
                  className="w-full bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}>{icon}</div>
                    <span className="font-semibold text-gray-800">{label}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
              <button onClick={() => { localStorage.clear(); setScreen('login'); setUserData(null); }}
                className="w-full bg-red-50 border border-red-200 rounded-xl p-4 hover:bg-red-100 transition flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-red-600" />
                </div>
                <span className="font-semibold text-red-600">Logout</span>
              </button>
            </div>
          </div>
        )}

        {/* SELECT FAMILY */}
        {screen === 'select-family-share' && (
          <div className="p-6">
            <div className="flex items-center mb-6">
              <button onClick={() => setScreen('home')} className="mr-3"><ArrowLeft className="w-6 h-6 text-gray-700" /></button>
              <h2 className="text-2xl font-bold text-gray-800">Select Family Members</h2>
            </div>
            <p className="text-gray-600 mb-6">Select family members whose IDs you want to share</p>
            <div className="space-y-3 mb-6">
              <div className="bg-indigo-50 border-2 border-indigo-300 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-indigo-200 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-indigo-700" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{userData?.name} (You)</h3>
                    <p className="text-sm text-gray-600">Primary Account</p>
                  </div>
                  <CheckCircle className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
              {familyMembers.map((member, idx) => (
                <div key={idx} onClick={() => toggleFamilyMember(idx)}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition ${selectedFamilyMembers.includes(idx) ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedFamilyMembers.includes(idx) ? 'bg-indigo-200' : 'bg-gray-200'}`}>
                      <User className={`w-6 h-6 ${selectedFamilyMembers.includes(idx) ? 'text-indigo-700' : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-gray-800">{member.name}</h3>
                        {member.isMinor && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">Minor</span>}
                      </div>
                      <p className="text-sm text-gray-600">{member.relation}</p>
                    </div>
                    {selectedFamilyMembers.includes(idx) && <CheckCircle className="w-6 h-6 text-indigo-600" />}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setScreen('scan-qr')}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition">
              Continue to Scan QR ({selectedFamilyMembers.length + 1} IDs)
            </button>
          </div>
        )}

        {/* SCAN QR */}
        {screen === 'scan-qr' && (
          <div className="p-6">
            <button onClick={() => { stopCamera(); setScreen('home'); }} className="mb-4 text-indigo-600">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Scan Hotel QR Code</h2>

            {/* Camera viewfinder */}
            <div className="relative bg-gray-900 rounded-2xl overflow-hidden mb-4" style={{aspectRatio:'1'}}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-4 border-white rounded-xl opacity-70"></div>
                </div>
              )}
              {!scanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <QrCode className="w-16 h-16 text-white opacity-30" />
                </div>
              )}
            </div>

            {cameraError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-sm text-red-700">{cameraError}</p>
              </div>
            )}

            {scanning ? (
              <div className="text-center">
                <p className="text-indigo-600 font-semibold mb-3">📷 Scanning... point at hotel QR code</p>
                <button onClick={stopCamera} className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={startCamera} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">
                📷 Open Camera to Scan
              </button>
            )}
          </div>
        )}

        {/* CONFIRM SHARE */}
        {screen === 'confirm-share' && scannedHotel && (
          <div className="p-8">
            <button onClick={() => setScreen('home')} className="mb-4 text-indigo-600"><ArrowLeft className="w-6 h-6" /></button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Confirm ID Share</h2>
            <p className="text-gray-500 mb-6">Sharing with {scannedHotel.name}</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
              <h3 className="font-bold text-lg text-gray-800">{scannedHotel.name}</h3>
              <p className="text-sm text-gray-600">{scannedHotel.location}</p>
              <p className="text-xs text-gray-400 mt-1 font-mono">Code: {scannedHotel.code}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Enter PIN to confirm</label>
              <input type="password" maxLength="4" placeholder="••••" value={sharePin}
                onChange={(e) => { setSharePin(e.target.value.replace(/\D/g, '')); setErrorMessage(''); }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl tracking-widest focus:ring-2 focus:ring-indigo-500"
              />
              {errorMessage && <p className="text-red-600 text-sm mt-2">⚠️ {errorMessage}</p>}
            </div>
            <button onClick={handleConfirmShare} disabled={sharing}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:bg-gray-300 transition">
              {sharing ? 'Sharing...' : 'Confirm & Share'}
            </button>
          </div>
        )}

        {/* SUCCESS */}
        {screen === 'success' && (
          <div className="p-8 text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full mx-auto mb-6 flex items-center justify-center">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">ID Shared Successfully!</h2>
            <p className="text-gray-500 mb-8">Your details have been securely shared with the hotel</p>
            <button onClick={() => setScreen('home')}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">
              Back to Home
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default MobileApp;
