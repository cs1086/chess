
import React, { useState, useEffect } from 'react';
import { useFirebase } from './hooks/useFirebase';
import { Auth } from './components/Auth/Auth';
import { Lobby } from './components/Home/Lobby';
import { RoomWaiting } from './components/Room/RoomWaiting';
import { Game } from './components/Game/Game';
import { MahjongBoard } from './components/Mahjong/MahjongBoard';
import { MahjongResult } from './components/Mahjong/MahjongResult';
import { BigTwoBoard } from './components/BigTwo/BigTwoBoard';
import { BigTwoResult } from './components/BigTwo/BigTwoResult';


const App: React.FC = () => {
  const [storedUserId, setStoredUserId] = useState<string | null>(localStorage.getItem('chess_userId'));
  const {
    user,
    leaderboard,
    messages,
    gameState,
    mahjongState,
    bigTwoState,
    isAdmin,
    rooms,
    currentRoom,
    isInLobby,
    createRoom,
    joinRoom,
    leaveRoom,
    kickPlayer,
    startGame,
    sendMessage,
    handleMove,
    handleFlip,
    surrender,
    requestRematch,
    exitGame,
    clearGames,
    clearUsers,
    clearStats,
    discardMahjongTile,
    performChi,
    performPong,
    performKong,
    performHu,
    skipAction,
    toggleReady,
    playBigTwoCards,
    passBigTwoTurn
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
    return <Auth onLogin={handleLogin} leaderboard={leaderboard} />;
  }

  // Game Mode
  if (currentRoom && (currentRoom.status === 'playing' || currentRoom.status === 'ended')) {
    if (currentRoom.gameType === 'chinese_dark_chess' && gameState) {
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
    } else if (currentRoom.gameType === 'mahjong' && mahjongState) {
      return (
        <div className="min-h-screen bg-[#1a120b] flex flex-col items-center justify-center p-2 md:p-4">
          <MahjongBoard
            gameState={mahjongState}
            currentUserId={user.id}
            onDiscard={(tile) => discardMahjongTile(tile.id)}
            onPong={performPong}
            onKong={performKong}
            onChi={performChi}
            onHu={performHu}
            onSkip={skipAction}
          />
          <button
            onClick={exitGame}
            className="mt-4 px-6 py-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors"
          >
            退出遊戲
          </button>
          {mahjongState.gameStatus === 'ended' && mahjongState.scoringResult && (
            <MahjongResult gameState={mahjongState} onExit={exitGame} />
          )}
        </div>
      );
    } else if (currentRoom.gameType === 'big_two' && bigTwoState) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-[#0a3d0a] to-[#062806] flex flex-col items-center justify-center p-2 md:p-4">
          <BigTwoBoard
            gameState={bigTwoState}
            currentUserId={user.id}
            onPlayCards={playBigTwoCards}
            onPass={passBigTwoTurn}
          />
          <button
            onClick={exitGame}
            className="mt-4 px-6 py-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors"
          >
            退出遊戲
          </button>
          {bigTwoState.gameStatus === 'ended' && (
            <BigTwoResult gameState={bigTwoState} currentUserId={user.id} onExit={exitGame} />
          )}
        </div>
      );
    } else {
      // Placeholder for other games
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f1e7] text-[#5c3a1e]">
          <h1 className="text-3xl font-bold mb-4">開發中</h1>
          <p className="mb-8">此遊戲模式尚未實作。</p>
          <button
            onClick={exitGame}
            className="px-6 py-2 bg-[#8b5a2b] text-white rounded-lg hover:bg-[#6d4621]"
          >
            離開遊戲
          </button>
        </div>
      );
    }
  }

  // Room Waiting Mode
  if (currentRoom && !isInLobby) {
    return (
      <RoomWaiting
        room={currentRoom}
        currentUser={user}
        messages={messages}
        onLeave={leaveRoom}
        onStartGame={startGame}
        onKickUser={kickPlayer}
        onSendMessage={sendMessage}
        onToggleReady={toggleReady}
      />
    );
  }

  // Lobby Mode
  return (
    <Lobby
      user={user}
      rooms={rooms}
      onCreateRoom={createRoom}
      onJoinRoom={joinRoom}
      onClearGames={clearGames}
      onClearUsers={clearUsers}
      onClearStats={clearStats}
      isAdmin={isAdmin}
    />
  );
};

export default App;
