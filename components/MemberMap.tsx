
import React, { useState, useEffect, useRef } from 'react';
import { storageService } from '../services/storageService';
import { MapPin, Search, Navigation, Crosshair, Loader2 } from 'lucide-react';
import { Member } from '../types';

// Declaration for the global Leaflet object added via CDN
declare const L: any;

interface MemberMapProps {
  currentUser: Member | null;
}

export const MemberMap: React.FC<MemberMapProps> = ({ currentUser }) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const layerGroupRef = useRef<any>(null);

  // Fetch real members on mount
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const members = await storageService.getAllMembers();
        if (Array.isArray(members)) {
          setAllMembers(members);
        } else {
          setAllMembers([]);
        }
      } catch (error) {
        console.error("Failed to fetch members", error);
        setAllMembers([]);
      }
    };
    fetchMembers();
  }, []);

  // Filter members based on search
  const filteredMembers = allMembers.filter(member =>
    (member.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (member.businessName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (member.location?.city?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const selectedMember = allMembers.find(m => m.id === selectedMemberId);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Initialize map centered on Congo (Kinshasa area generally)
    const map = L.map(mapContainerRef.current).setView([-4.4419, 15.2663], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Layer group for markers to easily clear/update them
    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers when filteredMembers changes
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    // Clear existing markers
    layerGroupRef.current.clearLayers();
    markersRef.current = {};

    const createCustomIcon = (avatarUrl: string, isCurrentUser: boolean) => {
      const borderColor = isCurrentUser ? '#3b82f6' : '#ef4444'; // Blue for me, Red for others
      return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-image: url('${avatarUrl}'); width: 40px; height: 40px; border-radius: 50%; background-size: cover; border: 3px solid ${borderColor}; box-shadow: 0 4px 6px rgba(0,0,0,0.3); background-color: white;"></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
      });
    };

    // Add markers for filtered members
    filteredMembers.forEach((member) => {
      // SAFETY CHECK: Skip if location is missing
      if (!member.location?.lat || !member.location?.lng) {
        console.warn(`Member ${member.id} (${member.name}) has no valid location cooordinates.`);
        return;
      }

      const isCurrentUser = currentUser?.id === member.id;
      const marker = L.marker([member.location.lat, member.location.lng], {
        icon: createCustomIcon(member.avatar, isCurrentUser),
        zIndexOffset: isCurrentUser ? 1000 : 0 // Put current user on top
      })
        .addTo(layerGroupRef.current)
        .bindPopup(`
        <div class="font-sans p-1 min-w-[150px]">
          <h3 class="font-bold text-sm ${isCurrentUser ? 'text-blue-600' : 'text-red-600'} mb-1">
            ${member.businessName} ${isCurrentUser ? '(Vous)' : ''}
          </h3>
          <p class="text-xs text-gray-800 font-medium">${member.name}</p>
          <p class="text-xs text-gray-500 mt-1 flex items-center">
            <span class="mr-1">📍</span> ${member.location.city || 'Ville inconnue'}
          </p>
          <span class="inline-block mt-2 px-2 py-0.5 ${isCurrentUser ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'} text-[10px] rounded-full font-semibold border">
            ${member.sector || 'Secteur non défini'}
          </span>
        </div>
      `);

      markersRef.current[member.id] = marker;

      marker.on('click', () => {
        setSelectedMemberId(member.id);
      });
    });

  }, [filteredMembers, currentUser]);

  // Handle FlyTo when selecting a member and fix map size
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Fix for the "blank map" issue - force Leaflet to recalculate its container size
    setTimeout(() => {
      mapInstanceRef.current.invalidateSize();
    }, 100);

    if (!selectedMemberId) return;

    const member = allMembers.find(m => m.id === selectedMemberId);
    if (member && member.location?.lat && member.location?.lng) {
      mapInstanceRef.current.flyTo(
        [member.location.lat, member.location.lng],
        15,
        { duration: 1.5, easeLinearity: 0.25 }
      );

      const marker = markersRef.current[member.id];
      if (marker) {
        setTimeout(() => marker.openPopup(), 500);
      }
    }
  }, [selectedMemberId, allMembers]);

  const handleLocateMe = () => {
    if (!currentUser) return;
    setIsLocating(true);

    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      setIsLocating(false);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          let detectedCity = currentUser.location.city;
          let detectedAddress = currentUser.location.address;

          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, {
              headers: {
                'User-Agent': 'PR-CONNEXION-Cluster-App/1.0'
              }
            });
            const data = await response.json();

            if (data && data.address) {
              detectedCity = data.address.city || data.address.town || data.address.village || data.address.municipality || detectedCity;
              const road = data.address.road || data.address.pedestrian;
              if (road) {
                detectedAddress = road;
              } else if (data.display_name) {
                detectedAddress = data.display_name.split(',')[0];
              }
            }
          } catch (geoError) {
            console.warn("Reverse geocoding failed, using coords only", geoError);
          }

          await storageService.updateUserLocation(
            currentUser.id,
            { lat: latitude, lng: longitude },
            { city: detectedCity, address: detectedAddress }
          );

          setAllMembers(prev => prev.map(m =>
            m.id === currentUser.id
              ? {
                ...m,
                location: {
                  lat: latitude,
                  lng: longitude,
                  city: detectedCity,
                  address: detectedAddress
                }
              }
              : m
          ));

          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([latitude, longitude], 18);
            setSelectedMemberId(currentUser.id);
          }
        } catch (e) {
          console.error("Error updating location", e);
          alert("Erreur lors de l'enregistrement de votre position.");
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Geolocation error", error);
        let msg = "Impossible de récupérer votre position.";
        if (error && typeof error === 'object') {
          if (error.code === 1) msg = "Accès à la localisation refusé.";
          else if (error.code === 2) msg = "Position indisponible.";
          else if (error.code === 3) msg = "Délai d'attente dépassé.";
        }
        alert(msg);
        setIsLocating(false);
      },
      options
    );
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4 overflow-hidden">
      {/* 1. Sidebar List */}
      <div className="w-full lg:w-1/4 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden max-h-[300px] lg:max-h-full transition-colors order-2 lg:order-1">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Membres ({filteredMembers.length})
          </h2>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
          {filteredMembers.length > 0 ? (
            filteredMembers.map(member => (
              <div
                key={member.id}
                onClick={() => setSelectedMemberId(member.id)}
                className={`p-2.5 rounded-lg cursor-pointer transition-all flex items-center space-x-3 border ${selectedMemberId === member.id
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-transparent'
                  }`}
              >
                <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full object-cover" />
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white truncate">{member.businessName || member.name}</h3>
                  <p className="text-[10px] text-gray-500 truncate">{member.location.city}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500 text-xs italic">Aucun membre.</div>
          )}
        </div>
      </div>

      {/* 2. Map Area */}
      <div className="flex-1 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden order-1 lg:order-2">
        <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-gray-100 dark:bg-gray-900" />

        {currentUser && (
          <button
            onClick={handleLocateMe}
            disabled={isLocating}
            className="absolute top-4 right-4 z-[1000] bg-white dark:bg-dark-card p-2.5 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center space-x-2 text-xs font-bold"
          >
            {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
            <span>Ma Position</span>
          </button>
        )}
      </div>

      {/* 3. Details Panel (New) */}
      <div className={`w-full lg:w-1/4 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden transition-all order-3 ${selectedMember ? 'lg:translate-x-0 opacity-100' : 'lg:translate-x-4 opacity-0 pointer-events-none hidden lg:flex'}`}>
        {selectedMember ? (
          <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
            <div className="h-24 bg-gradient-to-r from-primary-600 to-primary-800 relative">
              <button
                onClick={() => setSelectedMemberId(null)}
                className="absolute top-2 right-2 p-1.5 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 pb-6 -mt-10 flex-1 flex flex-col items-center">
              <img
                src={selectedMember.avatar}
                alt={selectedMember.name}
                className="w-20 h-20 rounded-full border-4 border-white dark:border-dark-card shadow-lg mb-3 object-cover"
              />

              <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center">{selectedMember.businessName}</h3>
              <p className="text-sm text-gray-500 mb-4">{selectedMember.name}</p>

              <div className="w-full space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Activité</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">{selectedMember.sector || 'Secteur non défini'}</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Localisation</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{selectedMember.location.address}, {selectedMember.location.city}</p>
                </div>

                <div className="pt-2">
                  <button
                    className="w-full bg-primary-600 text-white py-3 rounded-xl hover:bg-primary-700 transition-all font-bold text-sm shadow-md flex items-center justify-center space-x-2 group"
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${selectedMember.location.lat},${selectedMember.location.lng}`, '_blank')}
                  >
                    <Navigation className="w-4 h-4 group-hover:animate-pulse" />
                    <span>Ouvrir dans Google Maps</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-full mb-4">
              <MapPin className="w-8 h-8 opacity-20" />
            </div>
            <p className="text-sm">Sélectionnez un membre sur la carte pour voir ses détails.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Add standard X icon import
import { X } from 'lucide-react';
