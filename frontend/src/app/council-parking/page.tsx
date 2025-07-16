'use client';

import React, { useState } from 'react';
import axios from 'axios';

// Types
interface CouncilParkingSpace {
  id: string;
  street: string;
  area: string;
  code: string;
  description?: string;
  latitude: number;
  longitude: number;
  pricePerHour: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SearchParams {
  street: string;
  area: string;
}

export default function CouncilParkingPage() {
  const [searchParams, setSearchParams] = useState<SearchParams>({ street: '', area: '' });
  const [spaces, setSpaces] = useState<CouncilParkingSpace[]>([]);
  const [code, setCode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [selectedSpace, setSelectedSpace] = useState<CouncilParkingSpace | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    setError('');
    try {
      const response = await axios.get('/api/council-spaces/search', {
        params: {
          street: searchParams.street,
          area: searchParams.area,
        },
      });
      setSpaces(response.data.data.spaces);
    } catch (err) {
      setError('Failed to fetch council parking spaces.');
    }
  };

  const handleValidateCode = async () => {
    setError('');
    setQrCodeUrl('');
    setSelectedSpace(null);
    try {
      const response = await axios.post('/api/council-spaces/validate-code', { code });
      setQrCodeUrl(response.data.data.qrCodeUrl);
      setSelectedSpace(response.data.data.space);
    } catch (err) {
      setError('Invalid or inactive council parking code.');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Find Council Parking Spaces</h1>

      <div className="mb-6">
        <label className="block mb-2 font-semibold">Search by Street or Area</label>
        <input
          type="text"
          placeholder="Street"
          value={searchParams.street}
          onChange={(e) => setSearchParams({ ...searchParams, street: e.target.value })}
          className="border p-2 rounded mr-2"
        />
        <input
          type="text"
          placeholder="Area"
          value={searchParams.area}
          onChange={(e) => setSearchParams({ ...searchParams, area: e.target.value })}
          className="border p-2 rounded mr-2"
        />
        <button
          onClick={handleSearch}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Search
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {spaces.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Available Council Spaces</h2>
          <ul className="border rounded p-4 max-h-64 overflow-auto">
            {spaces.map((space) => (
              <li
                key={space.id}
                className="cursor-pointer p-2 hover:bg-gray-100"
                onClick={() => {
                  setSelectedSpace(space);
                  setQrCodeUrl('');
                  setCode('');
                  setError('');
                }}
              >
                {space.street}, {space.area} - £{space.pricePerHour.toFixed(2)} per hour
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6">
        <label className="block mb-2 font-semibold">Enter Code from Sign</label>
        <input
          type="text"
          placeholder="Enter code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="border p-2 rounded mr-2"
        />
        <button
          onClick={handleValidateCode}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          disabled={!code}
        >
          Generate QR Code
        </button>
      </div>

      {selectedSpace && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Selected Space</h3>
          <p>
            {selectedSpace.street}, {selectedSpace.area} - £{selectedSpace.pricePerHour.toFixed(2)} per hour
          </p>
        </div>
      )}

      {qrCodeUrl && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Your QR Code</h3>
          <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
        </div>
      )}
    </div>
  );
}
