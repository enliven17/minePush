import React from 'react';
import { Web3Provider } from './providers/Web3Provider';
import Game from './components/Game';
import './App.css';

function App() {
  return (
    <Web3Provider>
      <div className="App">
        <Game />
      </div>
    </Web3Provider>
  );
}

export default App;