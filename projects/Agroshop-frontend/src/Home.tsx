import React from 'react'
import Navbar from './components/Navbar'

const Home = () => {
  return (
    <div className='bg-gradient-to-br min-h-screen'>
      <Navbar/>
      <section className='py-7 space-y-7'>
          <h1 className='text-6xl tracking-wider text-center font-bold'>Visibility, Tracking of <br />
          Product Made <br />
          <span className='text-green-800'>Cheaper, Easier & Faster</span>
          </h1>
          <p className='max-w-[600px] text-center mx-auto'>Lorem ipsum dolor sit amet consectetur adipisicing elit. Tempore impedit atque placeat, fuga dolorum rem omnis, deserunt recusandae, quae tempora nisi deleniti praesentium reprehenderit ipsum. Tempore minus numquam odit nesciunt.</p>

        <div className='mx-auto flex items-center justify-center space-x-3'>
          <a href='account/' className='bg-gradient-to-r hover:bg-gradient-to-tr py-3 px-5 rounded-full text-white text-lg from-green-600 to-green-800'>
            Be a Supplier &#10095;
          </a>
          <button className='ring-1 py-3 px-5 hover:bg-green-700 hover:text-white rounded-full text-lg ring-green-700 text-green-700'>Shop Now</button>
        </div>

      </section>
    </div>
  )
}

export default Home
