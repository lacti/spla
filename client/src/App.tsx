import "./App.css";

import React from "react";
import { nanoid } from "nanoid";
import sprite1 from "./assets/walk_sprite_1_128.png";
import sprite2 from "./assets/walk_sprite_2_128.png";
import sprite3 from "./assets/walk_sprite_3_128.png";

function randomColor(): string {
  const rand256 = () => Math.floor(Math.random() * 256);
  return `rgb(${rand256()},${rand256()},${rand256()})`;
}

const maxX = 40;
const maxY = 40;

const spriteWidth = 32;
const spriteHeight = 32;
const spriteCount = 4;
const spriteImages = [sprite1, sprite2, sprite3];

interface Size {
  width: number;
  height: number;
}
const smallTileSize: Size = { width: 12, height: 12 };
const normalTileSize: Size = { width: 16, height: 16 };

interface Vec2 {
  x: number;
  y: number;
}
function vec2Equals(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}
function vec2ToVec1(p: Vec2): number {
  return p.x + p.y * maxX;
}

type CharacterDirection = "up" | "down" | "left" | "right";

interface CharacterState {
  id: string;
  color: string;
  spriteIndex: number;
  direction: CharacterDirection;
  position: Vec2;
}

const myInitialState: CharacterState = {
  id: nanoid(),
  color: randomColor(),
  spriteIndex: Math.floor(Math.random() * spriteImages.length),
  direction: "down",
  position: { x: 0, y: 0 },
};

interface GameContext {
  characters: CharacterState[];
  colors: string[];
}

function updatePosition(p: Vec2, direction: CharacterDirection): Vec2 {
  switch (direction) {
    case "up":
      return p.y > 0 ? { x: p.x, y: p.y - 1 } : p;
    case "down":
      return p.y + 1 < maxY ? { x: p.x, y: p.y + 1 } : p;
    case "left":
      return p.x > 0 ? { x: p.x - 1, y: p.y } : p;
    case "right":
      return p.x + 1 < maxX ? { x: p.x + 1, y: p.y } : p;
  }
}

interface HelloEvent {
  _type: "hello";
}
interface JoinEvent {
  _type: "join";
  leader: boolean;
}

interface ContextMessage {
  _type: "context";
  context: GameContext;
}

interface MoveMessage {
  _type: "move";
  id: string;
  color: string;
  direction: CharacterDirection;
  spriteIndex: number;
}

type GameMessage = HelloEvent | JoinEvent | ContextMessage | MoveMessage;

const wsPromise = new Promise<WebSocket>((resolve, reject) => {
  const ws = new WebSocket(
    "wss://e971geb4v6.execute-api.ap-northeast-2.amazonaws.com/dev"
  );
  ws.onopen = () => {
    resolve(ws);
  };
  ws.onerror = (event) => {
    reject(event);
  };
});

async function sendMessage(message: GameMessage) {
  return wsPromise
    .then((ws) => ws.send(JSON.stringify(message)))
    .catch((error) => console.error({ error, message }, "cannot send message"));
}

async function sendMove(direction: CharacterDirection) {
  return sendMessage({
    _type: "move",
    id: myInitialState.id,
    color: myInitialState.color,
    spriteIndex: myInitialState.spriteIndex,
    direction: direction,
  });
}

function mergeContext(left: GameContext, right: GameContext): GameContext {
  const rightCharacterIds = right.characters.map((c) => c.id);
  return {
    characters: [
      ...left.characters.filter((c) => !rightCharacterIds.includes(c.id)),
      ...right.characters,
    ],
    colors: right.colors,
  };
}

function reduceJoin(context: GameContext, message: JoinEvent) {
  if (message.leader) {
    sendMessage({
      _type: "context",
      context,
    });
  }
  return context;
}

function reduceMove(context: GameContext, message: MoveMessage) {
  const target = context.characters.find((c) => c.id === message.id);
  if (!target) {
    return {
      ...context,
      characters: [
        ...context.characters,
        {
          id: message.id,
          color: message.color,
          direction: message.direction,
          position: { x: 0, y: 0 },
          spriteIndex: message.spriteIndex,
        },
      ],
    };
  }

  const newPos = updatePosition(target.position, message.direction);
  if (vec2Equals(target.position, newPos)) {
    return context;
  }

  const newTarget: CharacterState = {
    ...target,
    direction: message.direction,
    position: newPos,
  };
  const newColors = [...context.colors];
  newColors[vec2ToVec1(target.position)] = newTarget.color;
  return {
    ...context,
    characters: context.characters.map((c) =>
      c.id !== message.id ? c : newTarget
    ),
    colors: newColors,
  };
}

function reduceContext(
  context: GameContext,
  message: GameMessage
): GameContext {
  switch (message._type) {
    case "hello":
      return context;
    case "join":
      return reduceJoin(context, message);
    case "context":
      return mergeContext(context, message.context);
    case "move":
      return reduceMove(context, message);
  }
}

function Game() {
  const [tileSize, setTileSize] = React.useState<Size>(normalTileSize);
  const [context, setContext] = React.useState<GameContext>({
    characters: [{ ...myInitialState }],
    colors: [],
  });

  React.useEffect(() => {
    wsPromise.then((ws) => {
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data) as GameMessage;
        setContext((context) => reduceContext(context, message));
      };
      sendMessage({ _type: "hello" });
    });
  }, []);

  React.useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      if (width < 600) {
        setTileSize(smallTileSize);
      } else {
        setTileSize(normalTileSize);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  });

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      switch (event.key) {
        case "ArrowUp":
          sendMove("up");
          break;
        case "ArrowDown":
          sendMove("down");
          break;
        case "ArrowLeft":
          sendMove("left");
          break;
        case "ArrowRight":
          sendMove("right");
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div
      className="m-auto relative my-6"
      style={{
        width: `${maxX * tileSize.width}px`,
        height: `${maxY * tileSize.height}px`,
      }}
    >
      {context.characters.map((c) => (
        <Character key={c.id} tileSize={tileSize} {...c} />
      ))}
      <table className="border-collapse">
        <tbody>
          {Array.from({ length: maxY }, (_, y) => (
            <tr key={`row#${y}`}>
              {Array.from({ length: maxX }, (_, x) => (
                <td
                  className="border"
                  key={`col#${y}#${x}`}
                  style={{
                    width: tileSize.width,
                    height: tileSize.height,
                    backgroundColor:
                      context.colors[vec2ToVec1({ x, y })] ?? undefined,
                  }}
                ></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Character({
  spriteIndex,
  direction,
  position: { x, y },
  tileSize: { width: tileWidth, height: tileHeight },
}: {
  spriteIndex: number;
  direction: CharacterDirection;
  position: Vec2;
  tileSize: Size;
}) {
  const [spriteX, setSpriteX] = React.useState(0);
  const spriteY = spriteYFromDirection(direction);
  React.useEffect(() => {
    const timer = window.setInterval(
      () => setSpriteX((old) => (old + 1) % spriteCount),
      150
    );
    return () => window.clearInterval(timer);
  }, [spriteIndex, direction]);
  return (
    <img
      src={spriteImages[spriteIndex]}
      alt="character"
      className="object-none"
      style={{
        width: `${spriteWidth}px`,
        height: `${spriteHeight}px`,
        objectPosition: `-${spriteX * spriteWidth}px -${
          spriteY * spriteHeight
        }px`,
        position: "absolute",
        left: x * tileWidth - (spriteWidth - tileWidth) / 2,
        top: y * tileHeight - spriteHeight + tileHeight,
        zIndex: vec2ToVec1({ x, y }),
      }}
    />
  );
}

function spriteYFromDirection(direction: CharacterDirection): number {
  switch (direction) {
    case "down":
      return 0;
    case "left":
      return 1;
    case "right":
      return 2;
    case "up":
      return 3;
  }
}

function App() {
  return (
    <div>
      <Game />
    </div>
  );
}

export default App;
