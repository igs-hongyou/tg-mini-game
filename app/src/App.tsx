import { GameProvider, useGame } from './net/GameContext';
import { GameRoom } from './pages/GameRoom';
import { Lobby } from './pages/Lobby';
import { WaitingRoom } from './pages/WaitingRoom';

function Screens() {
  const { state } = useGame();

  if (!state) return <Lobby />;
  if (state.phase === 'waiting') return <WaitingRoom />;
  return <GameRoom />;
}

function App() {
  return (
    <GameProvider>
      <Screens />
    </GameProvider>
  );
}

export default App;
