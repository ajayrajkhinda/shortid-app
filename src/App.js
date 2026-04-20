import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { Lock, Shield, CheckCircle, ArrowLeft, QrCode, Menu, X, History, Users, User, Settings, HelpCircle, LogOut, ChevronRight, Plus, Trash2, Phone, MapPin, Calendar, Edit3, Save } from 'lucide-react';

const API_URL = "https://shortid-backend-production.up.railway.app";

// Generate permanent SID once
const getOrCreateSID = () => {
  let sid = localStorage.getItem('userSID');
  if (!sid) {
    sid = 'SID-' + Math.random().toString(36).substring(2, 5).toUpperCase() +
          Math.random().toString(36).substring(2, 5).toUpperCase();
    localStorage.setItem('userSID', sid);
  }
  return sid;
};

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

  // Share history
  const [shareHistory, setShareHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Family members state
  const [familyMembers, setFamilyMembers] = useState(() => {
    const saved = localStorage.getItem('familyMembers');
    return saved ? JSON.parse(saved) : [
      { name: 'Priya Kumar', relation: 'Spouse', dob: '20/05/1992', gender: 'Female', isMinor: false },
      { name: 'Aarav Kumar', relation: 'Son', dob: '15/08/2015', gender: 'Male', isMinor: true }
    ];
  });
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', relation: '', dob: '', gender: 'Male', isMinor: false });

  // Settings state
  const [editProfile, setEditProfile] = useState(false);
  const [editedUser, setEditedUser] = useState(null);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [profileMsg, setProfileMsg] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  useEffect(() => {
    if (screen !== 'scan-qr') stopCamera();
  }, [screen]);

  // ─── CAMERA ───────────────────────────────────────────

  const startCamera = async () => {
    setCameraError('');
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        startScanning();
      }
    } catch {
      setCameraError('Camera access denied. Please allow camera permission and try again.');
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    setScanning(false);
  };

  const startScanning = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    scanIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) { stopCamera(); handleQRResult(code.data); }
    }, 300);
  };

  const handleQRResult = (qrData) => {
    try {
      const parsed = JSON.parse(qrData);
      setScannedHotel({ name: parsed.name || 'Hotel', location: parsed.location || '', code: parsed.hotelCode || qrData });
    } catch {
      setScannedHotel({ name: 'Hotel', location: '', code: qrData });
    }
    setScreen('confirm-share');
  };

  // ─── AUTH ─────────────────────────────────────────────

  const handleLogin = () => {
    setErrorMessage('');
    if (phoneNumber.length !== 10) { setErrorMessage('Please enter a 10-digit phone number.'); return; }
    setScreen('otp');
  };

  const handleOtpVerify = () => {
    if (otp.length === 6) {
      const existingUser = localStorage.getItem('userData');
      if (existingUser) { setUserData(JSON.parse(existingUser)); setScreen('home'); }
      else setScreen('credential-issuer');
    }
  };

  const handleFetchId = () => {
    setTimeout(() => {
      const sid = getOrCreateSID();
      const data = { name: 'Rajesh Kumar', address: 'H.No 245, Sector 21, Gurugram, Haryana - 122001', dob: '15/03/1990', gender: 'Male', phone: phoneNumber, sid };
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

  // ─── SHARE ────────────────────────────────────────────

  const handleConfirmShare = async () => {
    setErrorMessage('');
    const savedPin = localStorage.getItem('userPin');
    if (sharePin !== savedPin) { setErrorMessage('Wrong PIN. Please try again.'); return; }
    setSharing(true);
    try {
      const sid = getOrCreateSID();
      // Share primary guest
      const shares = [{ ...userData, sid }];
      // Add selected family members
      selectedFamilyMembers.forEach(idx => shares.push({ ...familyMembers[idx], phone: userData.phone, sid: sid + '-F' + idx }));

      for (const guest of shares) {
        await fetch(`${API_URL}/api/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hotelCode: scannedHotel.code,
            sidNumber: guest.sid,
            guestName: guest.name,
            guestPhone: guest.phone || userData.phone,
            guestDOB: guest.dob,
            guestGender: guest.gender || 'Male',
            guestAddress: guest.address || userData.address,
          })
        });
      }
      setScreen('success');
      setSharePin('');
      setErrorMessage('');
      setSelectedFamilyMembers([]);
    } catch (e) {
      setErrorMessage('Network error: ' + e.message);
    }
    setSharing(false);
  };

  // ─── SHARE HISTORY ────────────────────────────────────

  const loadShareHistory = async () => {
    setHistoryLoading(true);
    try {
      const phone = userData?.phone || JSON.parse(localStorage.getItem('userData') || '{}').phone;
      if (!phone) return;
      const res = await fetch(`${API_URL}/api/share/guest/${phone}`);
      const data = await res.json();
      if (data.success) setShareHistory(data.shares || []);
    } catch (e) { console.error(e); }
    setHistoryLoading(false);
  };

  // ─── FAMILY ───────────────────────────────────────────

  const saveFamilyMembers = (members) => {
    setFamilyMembers(members);
    localStorage.setItem('familyMembers', JSON.stringify(members));
  };

  const handleAddMember = () => {
    if (!newMember.name || !newMember.relation || !newMember.dob) return;
    saveFamilyMembers([...familyMembers, newMember]);
    setNewMember({ name: '', relation: '', dob: '', gender: 'Male', isMinor: false });
    setShowAddMember(false);
  };

  const handleDeleteMember = (idx) => {
    saveFamilyMembers(familyMembers.filter((_, i) => i !== idx));
  };

  // ─── SETTINGS ─────────────────────────────────────────

  const handleSaveProfile = () => {
    setProfileMsg('');
    const updated = { ...userData, ...editedUser };
    setUserData(updated);
    localStorage.setItem('userData', JSON.stringify(updated));
    setEditProfile(false);
    setProfileMsg('Profile updated successfully!');
    setTimeout(() => setProfileMsg(''), 3000);
  };

  const handleChangePin = () => {
    setPinMsg('');
    const savedPin = localStorage.getItem('userPin');
    if (oldPin !== savedPin) { setPinMsg('Current PIN is incorrect'); return; }
    if (newPin.length !== 4) { setPinMsg('New PIN must be 4 digits'); return; }
    if (newPin !== confirmNewPin) { setPinMsg('PINs do not match'); return; }
    localStorage.setItem('userPin', newPin);
    setOldPin(''); setNewPin(''); setConfirmNewPin('');
    setPinMsg('PIN changed successfully!');
    setTimeout(() => setPinMsg(''), 3000);
  };

  const toggleFamilyMember = (idx) => {
    setSelectedFamilyMembers(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  // ─── RENDER ───────────────────────────────────────────

  const Input = ({ label, ...props }) => (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}
      <input {...props} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* LOGIN */}
        {screen === 'login' && (
          <div className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-5xl font-bold"><span style={{color:'#002B5C'}}>Short</span><span style={{color:'#3DB5E6'}}>ID</span></h1>
              <p className="text-gray-500 mt-2">Your identity, minus the risk</p>
            </div>
            <Input label="Phone Number" type="tel" maxLength="10" placeholder="Enter 10 digit mobile number"
              value={phoneNumber} onChange={e => { setPhoneNumber(e.target.value.replace(/\D/g,'')); setErrorMessage(''); }} />
            {errorMessage && <p className="text-red-600 text-sm mb-3">⚠️ {errorMessage}</p>}
            <button onClick={handleLogin} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">Send OTP</button>
          </div>
        )}

        {/* OTP */}
        {screen === 'otp' && (
          <div className="p-8">
            <button onClick={() => setScreen('login')} className="mb-4 text-indigo-600"><ArrowLeft className="w-6 h-6"/></button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Enter OTP</h2>
            <p className="text-gray-500 mb-6">We sent a code to +91 {phoneNumber}</p>
            <input type="text" maxLength="6" placeholder="Enter 6 digit OTP" value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g,''))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl tracking-widest focus:ring-2 focus:ring-indigo-500 mb-2" />
            <p className="text-sm text-gray-400 text-center mb-4">Demo: enter any 6 digits</p>
            <button onClick={handleOtpVerify} disabled={otp.length!==6}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:bg-gray-300 transition">Verify OTP</button>
          </div>
        )}

        {/* CREDENTIAL ISSUER */}
        {screen === 'credential-issuer' && (
          <div className="p-8">
            <button onClick={() => setScreen('otp')} className="mb-4 text-indigo-600"><ArrowLeft className="w-6 h-6"/></button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Add Your Credential</h2>
            <p className="text-gray-600 mb-8">Identity Credential Issuer</p>
            <div className="space-y-4">
              {[['Continue with DigiLocker','bg-purple-100','text-purple-600'],['Continue with Direct AADHAAR','bg-orange-50','text-orange-600']].map(([label,bg,tc]) => (
                <button key={label} onClick={() => setScreen('fetch-id')}
                  className="w-full bg-white border-2 border-gray-200 rounded-xl p-5 hover:border-indigo-400 transition flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-800">{label}</span>
                  <div className={`w-12 h-12 ${bg} rounded-lg flex items-center justify-center`}>
                    <Shield className={`w-8 h-8 ${tc}`}/>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FETCH ID */}
        {screen === 'fetch-id' && (
          <div className="p-8">
            <button onClick={() => setScreen('credential-issuer')} className="mb-4 text-indigo-600"><ArrowLeft className="w-6 h-6"/></button>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Shield className="w-10 h-10 text-green-600"/>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Create ID Credentials</h2>
              <p className="text-gray-500">We'll securely fetch your details</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-blue-800"><strong>What we fetch:</strong><br/>• Your Name • Your Photo<br/>• Your Address • Date of Birth<br/><br/><strong>We DO NOT store your Aadhaar number</strong></p>
            </div>
            <button onClick={handleFetchId} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">Fetch My ID Details</button>
          </div>
        )}

        {/* SETUP PIN */}
        {screen === 'setup-pin' && (
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Lock className="w-10 h-10 text-purple-600"/>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Setup Secure PIN</h2>
              <p className="text-gray-500">Required before sharing your ID</p>
            </div>
            <Input label="Enter 4-digit PIN" type="password" maxLength="4" placeholder="••••" value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g,'')); setErrorMessage(''); }} />
            <Input label="Confirm PIN" type="password" maxLength="4" placeholder="••••" value={confirmPin}
              onChange={e => { setConfirmPin(e.target.value.replace(/\D/g,'')); setErrorMessage(''); }} />
            {errorMessage && <p className="text-red-600 text-sm mb-3">⚠️ {errorMessage}</p>}
            <button onClick={handleSetupPin} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">Setup PIN</button>
          </div>
        )}

        {/* HOME */}
        {screen === 'home' && userData && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">My Digital ID</h2>
              <button onClick={() => setScreen('menu')} className="p-2 hover:bg-gray-100 rounded-lg">
                <Menu className="w-6 h-6 text-gray-700"/>
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
              <p className="text-center text-gray-900 font-medium text-lg mb-2">{userData.dob}</p>
              <p className="text-center text-indigo-600 font-mono font-bold text-sm mb-4">{getOrCreateSID()}</p>
              <p className="text-gray-900 text-center leading-relaxed mb-6"><span className="font-semibold">Address: </span>{userData.address}</p>
              <div className="flex items-end justify-between">
                <div className="w-32 h-32 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center">
                  <QrCode className="w-20 h-20 text-indigo-600"/>
                </div>
                <div className="flex items-center bg-purple-600 text-white px-3 py-2 rounded-lg text-xs font-semibold">
                  <Shield className="w-4 h-4 mr-1"/>
                  <span>DIGILOCKER<br/>VERIFIED</span>
                </div>
              </div>
            </div>
            <button onClick={() => setScreen('scan-qr')}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center justify-center space-x-2 mb-3">
              <QrCode className="w-6 h-6"/><span>Scan Hotel QR Code</span>
            </button>
            {familyMembers.length > 0 && (
              <button onClick={() => setScreen('select-family-share')}
                className="w-full bg-white border-2 border-indigo-600 text-indigo-600 py-4 rounded-xl font-semibold hover:bg-indigo-50 transition flex items-center justify-center space-x-2">
                <Users className="w-6 h-6"/><span>Share with Family IDs</span>
              </button>
            )}
          </div>
        )}

        {/* MENU */}
        {screen === 'menu' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Menu</h2>
              <button onClick={() => setScreen('home')} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-6 h-6 text-gray-700"/></button>
            </div>
            <div className="space-y-3">
              {[
                { icon: <History className="w-5 h-5 text-blue-600"/>, bg:'bg-blue-100', label:'Share History', action: () => { loadShareHistory(); setScreen('share-history'); } },
                { icon: <Users className="w-5 h-5 text-green-600"/>, bg:'bg-green-100', label:'Family & Minors', action: () => setScreen('family-minors') },
                { icon: <Settings className="w-5 h-5 text-purple-600"/>, bg:'bg-purple-100', label:'Settings', action: () => { setEditedUser({...userData}); setScreen('settings'); } },
                { icon: <HelpCircle className="w-5 h-5 text-orange-600"/>, bg:'bg-orange-100', label:'Help & Support', action: () => setScreen('help') },
              ].map(({ icon, bg, label, action }) => (
                <button key={label} onClick={action}
                  className="w-full bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}>{icon}</div>
                    <span className="font-semibold text-gray-800">{label}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400"/>
                </button>
              ))}
              <button onClick={() => { localStorage.removeItem('hotelToken'); localStorage.removeItem('hotelId'); setScreen('login'); setUserData(null); setPhoneNumber(''); setOtp(''); }}
                className="w-full bg-red-50 border border-red-200 rounded-xl p-4 hover:bg-red-100 transition flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><LogOut className="w-5 h-5 text-red-600"/></div>
                <span className="font-semibold text-red-600">Logout</span>
              </button>
            </div>
          </div>
        )}

        {/* SHARE HISTORY */}
        {screen === 'share-history' && (
          <div className="p-6">
            <div className="flex items-center mb-6">
              <button onClick={() => setScreen('menu')} className="mr-3"><ArrowLeft className="w-6 h-6 text-gray-700"/></button>
              <h2 className="text-2xl font-bold text-gray-800">Share History</h2>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 flex items-center space-x-2">
              <span className="text-indigo-700 font-mono font-bold text-sm">{getOrCreateSID()}</span>
              <span className="text-indigo-500 text-xs">— Your ShortID</span>
            </div>
            {historyLoading ? (
              <div className="text-center py-12 text-gray-400">Loading history...</div>
            ) : shareHistory.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-gray-300 mx-auto mb-3"/>
                <p className="text-gray-500">No shares yet</p>
                <p className="text-sm text-gray-400 mt-1">Hotels you check in to will appear here</p>
              </div>
            ) : shareHistory.map((s, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-800">{s.hotelName || 'Hotel'}</h3>
                    {s.hotelLocation && <p className="text-sm text-gray-500 flex items-center mt-1"><MapPin className="w-3 h-3 mr-1"/>{s.hotelLocation}</p>}
                    <p className="text-xs text-gray-400 flex items-center mt-1"><Calendar className="w-3 h-3 mr-1"/>{new Date(s.sharedAt).toLocaleString()}</p>
                    <p className="text-xs font-mono text-indigo-600 mt-1">{s.sidNumber}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${s.status==='approved'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>
                    {s.status==='approved'?'Approved':'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FAMILY & MINORS */}
        {screen === 'family-minors' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button onClick={() => setScreen('menu')} className="mr-3"><ArrowLeft className="w-6 h-6 text-gray-700"/></button>
                <h2 className="text-2xl font-bold text-gray-800">Family & Minors</h2>
              </div>
              <button onClick={() => setShowAddMember(true)} className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center">
                <Plus className="w-5 h-5 text-white"/>
              </button>
            </div>

            {/* Primary member */}
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-indigo-200 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-indigo-700"/>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">{userData?.name} <span className="text-indigo-500 text-sm">(You)</span></h3>
                  <p className="text-xs text-gray-500">Primary • {userData?.dob}</p>
                  <p className="text-xs font-mono text-indigo-600">{getOrCreateSID()}</p>
                </div>
              </div>
            </div>

            {familyMembers.map((m, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-500"/>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-gray-800">{m.name}</h3>
                      {m.isMinor && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">Minor</span>}
                    </div>
                    <p className="text-xs text-gray-500">{m.relation} • {m.dob}</p>
                    <p className="text-xs font-mono text-indigo-600">{getOrCreateSID()}-F{idx}</p>
                  </div>
                  <button onClick={() => handleDeleteMember(idx)} className="p-2 text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            ))}

            {familyMembers.length === 0 && !showAddMember && (
              <div className="text-center py-8 text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 text-gray-300"/>
                <p>No family members added yet</p>
                <p className="text-sm mt-1">Tap + to add</p>
              </div>
            )}

            {/* Add member form */}
            {showAddMember && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-4">
                <h3 className="font-bold text-gray-800 mb-3">Add Family Member</h3>
                {[['Full Name','name','text'],['Relation (e.g. Spouse, Son)','relation','text'],['Date of Birth (DD/MM/YYYY)','dob','text']].map(([ph,key,type]) => (
                  <input key={key} type={type} placeholder={ph} value={newMember[key]}
                    onChange={e => setNewMember({...newMember, [key]: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-sm focus:ring-2 focus:ring-indigo-500"/>
                ))}
                <select value={newMember.gender} onChange={e => setNewMember({...newMember, gender: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-sm">
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
                <label className="flex items-center space-x-2 mb-3">
                  <input type="checkbox" checked={newMember.isMinor} onChange={e => setNewMember({...newMember, isMinor: e.target.checked})} className="rounded"/>
                  <span className="text-sm text-gray-700">This is a minor (under 18)</span>
                </label>
                <div className="flex space-x-2">
                  <button onClick={handleAddMember} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold">Add</button>
                  <button onClick={() => setShowAddMember(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-semibold">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {screen === 'settings' && (
          <div className="p-6 overflow-y-auto" style={{maxHeight:'90vh'}}>
            <div className="flex items-center mb-6">
              <button onClick={() => setScreen('menu')} className="mr-3"><ArrowLeft className="w-6 h-6 text-gray-700"/></button>
              <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
            </div>

            {/* Profile */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">Profile Details</h3>
                <button onClick={() => setEditProfile(!editProfile)} className="text-indigo-600 flex items-center space-x-1 text-sm font-semibold">
                  {editProfile ? <><X className="w-4 h-4"/><span>Cancel</span></> : <><Edit3 className="w-4 h-4"/><span>Edit</span></>}
                </button>
              </div>
              {profileMsg && <p className="text-green-600 text-sm mb-2">✓ {profileMsg}</p>}
              {editProfile && editedUser ? (
                <div>
                  {[['Full Name','name','text'],['Address','address','text'],['Date of Birth','dob','text']].map(([label,key,type]) => (
                    <div key={key} className="mb-3">
                      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                      <input type={type} value={editedUser[key]||''} onChange={e => setEditedUser({...editedUser,[key]:e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"/>
                    </div>
                  ))}
                  <div className="mb-3">
                    <label className="text-xs text-gray-500 mb-1 block">Gender</label>
                    <select value={editedUser.gender||'Male'} onChange={e => setEditedUser({...editedUser,gender:e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                  <button onClick={handleSaveProfile} className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center space-x-2">
                    <Save className="w-4 h-4"/><span>Save Profile</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {[['Name', userData?.name], ['DOB', userData?.dob], ['Gender', userData?.gender], ['Phone', userData?.phone], ['ShortID', getOrCreateSID()]].map(([label,val]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-gray-500">{label}</span>
                      <span className={`font-medium ${label==='ShortID'?'font-mono text-indigo-600':''}`}>{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Change PIN */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <h3 className="font-bold text-gray-800 mb-3">Change PIN</h3>
              {pinMsg && <p className={`text-sm mb-2 ${pinMsg.includes('success')?'text-green-600':'text-red-600'}`}>{pinMsg.includes('success')?'✓':''} {pinMsg}</p>}
              <input type="password" maxLength="4" placeholder="Current PIN" value={oldPin}
                onChange={e => setOldPin(e.target.value.replace(/\D/g,''))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-center text-xl tracking-widest focus:ring-2 focus:ring-indigo-500"/>
              <input type="password" maxLength="4" placeholder="New PIN" value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g,''))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-center text-xl tracking-widest focus:ring-2 focus:ring-indigo-500"/>
              <input type="password" maxLength="4" placeholder="Confirm New PIN" value={confirmNewPin}
                onChange={e => setConfirmNewPin(e.target.value.replace(/\D/g,''))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 text-center text-xl tracking-widest focus:ring-2 focus:ring-indigo-500"/>
              <button onClick={handleChangePin} className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold">Update PIN</button>
            </div>

            {/* Danger zone */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="font-bold text-red-700 mb-2">Danger Zone</h3>
              <p className="text-sm text-red-600 mb-3">This will delete all your local data and log you out.</p>
              <button onClick={() => { localStorage.clear(); setScreen('login'); setUserData(null); }}
                className="w-full bg-red-600 text-white py-2 rounded-lg text-sm font-semibold">Clear All Data & Logout</button>
            </div>
          </div>
        )}

        {/* HELP & SUPPORT */}
        {screen === 'help' && (
          <div className="p-6">
            <div className="flex items-center mb-6">
              <button onClick={() => setScreen('menu')} className="mr-3"><ArrowLeft className="w-6 h-6 text-gray-700"/></button>
              <h2 className="text-2xl font-bold text-gray-800">Help & Support</h2>
            </div>

            {/* FAQ */}
            {[
              ['What is ShortID?', 'ShortID is a secure digital identity app that lets you share your verified ID with hotels without exposing your Aadhaar number. You get a unique ShortID number that acts like a passport.'],
              ['How does hotel check-in work?', 'Scan the hotel\'s QR code at reception, enter your PIN to confirm, and your verified details are instantly shared with the hotel — no paperwork needed.'],
              ['Is my Aadhaar number stored?', 'No. We only store your name, photo, address and date of birth. Your Aadhaar number is never stored on our servers.'],
              ['What is my ShortID number?', 'Your ShortID (e.g. SID-XXXXX) is a unique permanent identifier assigned to you — like a passport number. Hotels use it to identify you across check-ins.'],
              ['Can I share family member IDs?', 'Yes! Add family members in the Family & Minors section. When checking in, you can select which family members to include in the share.'],
              ['What if I forget my PIN?', 'Go to Settings → Change PIN. You\'ll need your current PIN. If you\'ve forgotten it completely, use Clear All Data & Logout and set up again.'],
            ].map(([q, a], i) => (
              <FaqItem key={i} question={q} answer={a} />
            ))}

            {/* Contact */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mt-4">
              <h3 className="font-bold text-gray-800 mb-2">Contact Us</h3>
              <div className="flex items-center space-x-2 mb-2">
                <Phone className="w-4 h-4 text-indigo-600"/>
                <span className="text-sm text-gray-700">support@shortid.in</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-indigo-600"/>
                <span className="text-sm text-gray-700">Available Mon–Sat, 9am–6pm IST</span>
              </div>
            </div>
          </div>
        )}

        {/* SELECT FAMILY TO SHARE */}
        {screen === 'select-family-share' && (
          <div className="p-6">
            <div className="flex items-center mb-6">
              <button onClick={() => setScreen('home')} className="mr-3"><ArrowLeft className="w-6 h-6 text-gray-700"/></button>
              <h2 className="text-2xl font-bold text-gray-800">Select Members</h2>
            </div>
            <p className="text-gray-600 mb-4">Select who to include in this check-in</p>
            <div className="space-y-3 mb-6">
              <div className="bg-indigo-50 border-2 border-indigo-300 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-indigo-200 rounded-full flex items-center justify-center"><User className="w-6 h-6 text-indigo-700"/></div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{userData?.name} (You)</h3>
                    <p className="text-xs text-gray-500">Primary Account</p>
                  </div>
                  <CheckCircle className="w-6 h-6 text-indigo-600"/>
                </div>
              </div>
              {familyMembers.map((member, idx) => (
                <div key={idx} onClick={() => toggleFamilyMember(idx)}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition ${selectedFamilyMembers.includes(idx)?'bg-indigo-50 border-indigo-300':'bg-white border-gray-200'}`}>
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedFamilyMembers.includes(idx)?'bg-indigo-200':'bg-gray-200'}`}>
                      <User className={`w-6 h-6 ${selectedFamilyMembers.includes(idx)?'text-indigo-700':'text-gray-600'}`}/>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-gray-800">{member.name}</h3>
                        {member.isMinor && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">Minor</span>}
                      </div>
                      <p className="text-sm text-gray-600">{member.relation}</p>
                    </div>
                    {selectedFamilyMembers.includes(idx) && <CheckCircle className="w-6 h-6 text-indigo-600"/>}
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
            <button onClick={() => { stopCamera(); setScreen('home'); }} className="mb-4 text-indigo-600"><ArrowLeft className="w-6 h-6"/></button>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Scan Hotel QR Code</h2>
            <div className="relative bg-gray-900 rounded-2xl overflow-hidden mb-4" style={{aspectRatio:'1'}}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay/>
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-4 border-white rounded-xl opacity-70"></div>
                </div>
              )}
              {!scanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <QrCode className="w-16 h-16 text-white opacity-30"/>
                </div>
              )}
            </div>
            {cameraError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4"><p className="text-sm text-red-700">{cameraError}</p></div>}
            {scanning ? (
              <div className="text-center">
                <p className="text-indigo-600 font-semibold mb-3">📷 Scanning... point at hotel QR code</p>
                <button onClick={stopCamera} className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
              </div>
            ) : (
              <button onClick={startCamera} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">📷 Open Camera to Scan</button>
            )}
          </div>
        )}

        {/* CONFIRM SHARE */}
        {screen === 'confirm-share' && scannedHotel && (
          <div className="p-8">
            <button onClick={() => setScreen('home')} className="mb-4 text-indigo-600"><ArrowLeft className="w-6 h-6"/></button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Confirm ID Share</h2>
            <p className="text-gray-500 mb-6">Sharing with {scannedHotel.name}</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
              <h3 className="font-bold text-lg text-gray-800">{scannedHotel.name}</h3>
              {scannedHotel.location && <p className="text-sm text-gray-600">{scannedHotel.location}</p>}
              <p className="text-xs text-gray-400 mt-1 font-mono">Code: {scannedHotel.code}</p>
            </div>
            {selectedFamilyMembers.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4">
                <p className="text-sm text-indigo-700 font-semibold">Sharing {selectedFamilyMembers.length + 1} IDs:</p>
                <p className="text-xs text-indigo-600">{userData?.name} + {selectedFamilyMembers.map(i => familyMembers[i]?.name).join(', ')}</p>
              </div>
            )}
            <label className="block text-sm font-medium text-gray-700 mb-2">Enter PIN to confirm</label>
            <input type="password" maxLength="4" placeholder="••••" value={sharePin}
              onChange={e => { setSharePin(e.target.value.replace(/\D/g,'')); setErrorMessage(''); }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl tracking-widest focus:ring-2 focus:ring-indigo-500 mb-2"/>
            {errorMessage && <p className="text-red-600 text-sm mb-3">⚠️ {errorMessage}</p>}
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
              <CheckCircle className="w-16 h-16 text-green-600"/>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">ID Shared Successfully!</h2>
            <p className="text-gray-500 mb-2">Your details have been securely shared</p>
            <p className="text-indigo-600 font-mono text-sm font-bold mb-8">{getOrCreateSID()}</p>
            <button onClick={() => setScreen('home')}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">Back to Home</button>
          </div>
        )}

      </div>
    </div>
  );
};

// FAQ accordion item
const FaqItem = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl mb-2 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50">
        <span className="font-semibold text-gray-800 text-sm">{question}</span>
        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${open?'rotate-90':''}`}/>
      </button>
      {open && <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">{answer}</div>}
    </div>
  );
};

export default MobileApp;
