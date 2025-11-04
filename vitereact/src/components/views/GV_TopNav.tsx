import React from 'react';

const GV_TopNav: React.FC = () => {
  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">BarberSlot</h1>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default GV_TopNav;
