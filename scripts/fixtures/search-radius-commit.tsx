// Browser-only harness: inspect the actual input in the parent's layout phase,
// before passive effects can conceal a stale value committed to the DOM.
import React, {useLayoutEffect, useRef, useState} from 'react'
import {createRoot} from 'react-dom/client'
import SearchRadiusInput from '../../src/components/home/SearchRadiusInput'
function Harness() {
 const [value,setValue]=useState(0.4)
 const root=useRef<HTMLDivElement>(null)
 useLayoutEffect(()=>{
  root.current!.dataset.committed=String(value)+':'+root.current!.querySelector('input')!.value
 },[value])
 return <div ref={root} id="radius-commit"><SearchRadiusInput value={value} onChange={setValue}/>
  <button onClick={()=>setValue(20)}>20 km</button>
  <button onClick={()=>setValue(0.4)}>400 m</button></div>
}
createRoot(document.getElementById('root')!).render(<Harness/> )
