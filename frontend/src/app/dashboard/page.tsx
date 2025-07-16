'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/providers/AuthProvider';

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  totalCost: number;
  status: string;
  space: {
    title: string;
    address: string;
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await axios.get('/api/bookings', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });
        setBookings(response.data.data.bookings);
      } catch (err) {
        setError('Failed to load bookings.');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">My Bookings</h1>
      {loading && <p>Loading bookings...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && bookings.length === 0 && <p>No bookings found.</p>}
      <ul>
        {bookings.map((booking) => (
          <li key={booking.id} className="border p-4 rounded mb-4">
            <h2 className="text-xl font-semibold">{booking.space.title}</h2>
            <p>{booking.space.address}</p>
            <p>
              {new Date(booking.startTime).toLocaleString()} - {new Date(booking.endTime).toLocaleString()}
            </p>
            <p>Status: {booking.status}</p>
            <p>Total Cost: £{booking.totalCost.toFixed(2)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
