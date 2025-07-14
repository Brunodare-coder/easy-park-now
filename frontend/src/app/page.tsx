/**
 * Homepage Component
 * 
 * This is the main landing page for EasyParkNow.
 * It includes hero section, features, testimonials, and call-to-action sections.
 */

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <nav className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-blue-600">EasyParkNow</h1>
          </div>
          
          <div className="hidden md:flex space-x-8">
            <Link href="#drivers" className="text-gray-600 hover:text-blue-600">For Drivers</Link>
            <Link href="#hosts" className="text-gray-600 hover:text-blue-600">For Hosts</Link>
            <Link href="#help" className="text-gray-600 hover:text-blue-600">Help</Link>
          </div>
          
          <div className="flex space-x-4">
            <Link href="/login" className="text-gray-600 hover:text-blue-600">Login</Link>
            <Link href="/register" className="btn btn-primary btn-md">Sign Up</Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Find Perfect Parking<br />
            <span className="text-blue-600">Anywhere, Anytime</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto">
            Book verified parking spaces instantly or earn money by renting out your driveway
          </p>
          
          {/* Search Bar */}
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-12 max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-4">
              <input 
                type="text" 
                placeholder="Where do you want to park?" 
                className="input flex-1"
              />
              <button className="btn btn-primary btn-lg">
                Search
              </button>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link href="/find-parking" className="btn btn-primary btn-lg">
              🚗 I Need Parking
            </Link>
            <Link href="/list-space" className="btn btn-success btn-lg">
              🏠 I Have a Space
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works - Drivers */}
      <section id="drivers" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">How It Works for Drivers</h2>
          <p className="text-xl text-gray-600 text-center mb-16">Book parking in 3 simple steps</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">🔍</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">1. Search & Compare</h3>
              <p className="text-gray-600">Enter your destination and find available parking spaces with real-time pricing</p>
            </div>
            
            <div className="text-center">
              <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">📱</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">2. Book Instantly</h3>
              <p className="text-gray-600">Reserve your spot with one click and pay securely through the app</p>
            </div>
            
            <div className="text-center">
              <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">🚗</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">3. Park & Go</h3>
              <p className="text-gray-600">Follow GPS directions to your space and start/stop parking with the app</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Hosts */}
      <section id="hosts" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">How It Works for Space Owners</h2>
          <p className="text-xl text-gray-600 text-center mb-16">Start earning from your driveway in 3 steps</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">📝</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">1. List Your Space</h3>
              <p className="text-gray-600">Add photos, set your price, and describe your parking space</p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">📅</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">2. Get Booked</h3>
              <p className="text-gray-600">Drivers find and book your space automatically</p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">3. Get Paid</h3>
              <p className="text-gray-600">Earn £100+ per month with automatic monthly payouts</p>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <Link href="/list-space" className="btn btn-success btn-lg">
              Start Earning Today
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Why Choose EasyParkNow?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="font-semibold mb-2">Instant Booking</h3>
              <p className="text-gray-600 text-sm">Book and pay in seconds</p>
            </div>
            
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="font-semibold mb-2">Secure Payment</h3>
              <p className="text-gray-600 text-sm">Safe & encrypted transactions</p>
            </div>
            
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📍</span>
              </div>
              <h3 className="font-semibold mb-2">GPS Navigation</h3>
              <p className="text-gray-600 text-sm">Direct routes to your space</p>
            </div>
            
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔋</span>
              </div>
              <h3 className="font-semibold mb-2">EV Charging</h3>
              <p className="text-gray-600 text-sm">Electric vehicle friendly</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">What Our Users Say</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="card">
              <div className="card-content">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <span className="font-semibold text-blue-600">SM</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">Sarah M.</h4>
                    <p className="text-gray-600 text-sm">Driver</p>
                  </div>
                </div>
                <p className="text-gray-700 mb-4">"Found parking near the stadium in seconds! So much easier than driving around looking for a spot."</p>
                <div className="flex text-yellow-400">
                  ⭐⭐⭐⭐⭐
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="card-content">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <span className="font-semibold text-green-600">JD</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">John D.</h4>
                    <p className="text-gray-600 text-sm">Space Owner</p>
                  </div>
                </div>
                <p className="text-gray-700 mb-4">"I'm earning £150 per month just by renting out my driveway. It's completely passive income!"</p>
                <div className="flex text-yellow-400">
                  ⭐⭐⭐⭐⭐
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="card-content">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                    <span className="font-semibold text-purple-600">AL</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">Anna L.</h4>
                    <p className="text-gray-600 text-sm">Driver</p>
                  </div>
                </div>
                <p className="text-gray-700 mb-4">"The app is so user-friendly. I can extend my parking time with just one tap!"</p>
                <div className="flex text-yellow-400">
                  ⭐⭐⭐⭐⭐
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">Join thousands of drivers and space owners using EasyParkNow</p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link href="/find-parking" className="btn bg-white text-blue-600 hover:bg-gray-100 btn-lg">
              Find Parking Now
            </Link>
            <Link href="/list-space" className="btn border-2 border-white text-white hover:bg-white hover:text-blue-600 btn-lg">
              List Your Space
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold text-blue-400 mb-4">EasyParkNow</h3>
              <p className="text-gray-400 mb-4">Making parking simple and profitable for everyone.</p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">For Drivers</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/find-parking" className="hover:text-white">Find Parking</Link></li>
                <li><Link href="/dashboard" className="hover:text-white">My Bookings</Link></li>
                <li><Link href="/help" className="hover:text-white">How It Works</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">For Hosts</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/list-space" className="hover:text-white">List Your Space</Link></li>
                <li><Link href="/host-dashboard" className="hover:text-white">Host Dashboard</Link></li>
                <li><Link href="/help/hosting" className="hover:text-white">Host Guide</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/help" className="hover:text-white">Help Center</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact Us</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2024 EasyParkNow. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
