import React, { useState, useEffect } from 'react';
import { useFirebase } from './hooks/useFirebase';
import { Auth } from './components/Auth/Auth';
import { Home } from './components/Home/Home';
import { ChatRoom } from './components/ChatRoom/ChatRoom';
import { Game } from './components/Game/Game';

const App: React.FC = () => {
  const [storedUserId, setStoredUserId] = useState<string | null>(localStorage.getItem('chess_userId'));
  const {
    user,
    leaderboard,
    onlinePlayers,
    messages,
    receivedChallenge,
    gameState,
    toggleChatRoom,
    sendMessage,
    sendChallenge,
    acceptChallenge,
    rejectChallenge,
    handleMove,
    handleFlip,
    surrender,
    requestRematch,
    exitGame
  } = useFirebase(storedUserId);

  useEffect(() => {
    if (storedUserId) {
      localStorage.setItem('chess_userId', storedUserId);
    }
  }, [storedUserId]);

  const handleLogin = (id: string) => {
    setStoredUserId(id);
  };


  if (!storedUserId || !user) {
    return <Auth onLogin={handleLogin} />;
  }

  if (gameState) {
    return (
      <Game
        gameState={gameState}
        currentUserId={user.id}
        onMove={handleMove}
        onFlip={handleFlip}
        onSurrender={surrender}
        onRematch={requestRematch}
        onExit={exitGame}
      />
    );
  }

  if (user.inChatRoom) {
    return (
      <ChatRoom
        currentUser={user}
        onlinePlayers={onlinePlayers}
        messages={messages}
        onSendMessage={sendMessage}
        onSendChallenge={sendChallenge}
        onLeave={() => toggleChatRoom(false)}
        receivedChallenge={receivedChallenge || undefined}
        onAcceptChallenge={acceptChallenge}
        onRejectChallenge={rejectChallenge}
      />
    );
  }

  return (
    <Home
      user={user}
      leaderboard={leaderboard}
      onJoinChat={() => toggleChatRoom(true)}
    />
  );
};

export default App;
