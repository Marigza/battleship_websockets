import WebSocket from 'ws';

export interface CommandData {
  type: string;
  data: string;
  id: number;
}

export interface CustomSocket extends WebSocket {
  id: number;
}

export interface UserRegistration {
  name: string;
  index: number;
  error: boolean;
  errorText: string;
}

export interface UserData {
  name: string;
  password: string;
}

export interface Winner {
  name: string;
  wins: number;
}

export interface CurrentSessionUser {
  indexUser: number;
  userData: string;
}

export interface Ship {
  position: {
    x: number;
    y: number;
  };
  direction: boolean;
  length: number;
  type: 'small' | 'medium' | 'large' | 'huge';
}

export interface Attack {
  gameId: number;
  x?: number;
  y?: number;
  indexPlayer: number;
}

export interface ShipInBattle {
  position: string[];
  length: number;
  type: 'small' | 'medium' | 'large' | 'huge';
  isKill: boolean;
  isShot: boolean;
  aliveLength: number;
}
