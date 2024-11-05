import React from 'react'

const Links:linkProp[] = [
  {
    id:1,
    name:'Home',
    url:'/'
  },
  {
    id:1,
    name:'About',
    url:'about/'
  },
  {
    id:1,
    name:'Contact',
    url:'contact/'
  },
  {
    id:1,
    name:'Supplier',
    url:'supplier/'
  },
]

const Navbar = () => {
  return (
    <div className='bg-gradient-to-r from-green-500 py-1 to-green-900'>
      <div className='flex justify-between items-center w-[95%] md:w-[90%]  lg:w-[80%] mx-auto'>

      <a href='/'>
        <img src="public/agro.jpg" className='w-20 h-20 rounded-full' alt="" />
      </a>
      <div className='flex space-x-3'>
      {
        Links.map(lin => (
          <a key={lin.id} className='text-white text-md' href={lin.url}>{lin.name}</a>
        ))
      }

      </div>
      <div>
        <button className='px-5 py-3 hover:bg-white hover:text-black rounded-full ring-1 ring-white  text-white'>Connect</button>
      </div>
      </div>
    </div>
  )
}

export default Navbar
