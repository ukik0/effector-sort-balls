import './App.css'
import {GenericTemplate} from "./ui/generic";
import {BrowserRouter, Route, Routes} from "react-router-dom";
import {HomePage} from "./pages/Home";
function App() {

    return (
     <BrowserRouter>
         <Routes>
             <Route path={'/'} element={<HomePage/>}/>
             </Routes>
     </BrowserRouter>
  )
}

export default App
