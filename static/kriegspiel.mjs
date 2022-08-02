import { Chess } from 'chess.js';
import { Chessboard } from 'chessboard.module.js';
import { Game as Engine } from 'js-chess-engine';
import * as $ from 'jquery';


const HUMAN_COLOR = 'w';
const AI_COLOR = 'b';
const LIGHT_FOG_COLOR = '#a9a9a9';
const DARK_FOG_COLOR = '#696969';
const HIGHLIGHT_CLASS = "highlight1-32417";
const PIECE_VALUES = {
  'p': 1,
  'n': 3,
  'b': 3,
  'r': 5,
  'q': 9,
  'k': 10,
}
const AI_LEVEL = 3;


// handle state when switching to the next player's turn
function nextTurn (shared_game, ai_game, board) {
  showFogOfWar(shared_game, board);
  //board.position(shared_game.fen());

  if (shared_game.game_over()) {
    endGame(shared_game, board);
  } else if(shared_game.turn() === AI_COLOR) {
    // set cursor and status for AI state
    document.body.style.cursor = "wait";
    $("#turn").text("AI is thinking ...");
    //const delay = 500 + 500 * Math.random();
    // XXX change to worker thread to avoid blocking UI
    window.setTimeout(function() { decideAiMove(shared_game, ai_game, board) }, 0);
  } else {
    // set cursor and status for human state
    document.body.style.cursor = "default";
    $("#turn").text(shared_game.in_check() ? "Check!" : "Your turn");
  }
}

// set status at end of the game
function endGame (shared_game, board) {
  // show full board and clear styling
  document.body.style.cursor = "default";
  $('#board .square-55d63').css('background', '');
  $("#turn").text(getVictoryType(shared_game));
  board.position(shared_game.fen());
  // show move history
  $("#history").html(shared_game.pgn({ max_width: 5, newline_char: '<br />' }));
}

// get the type of end game
function getVictoryType (shared_game) {
  if (shared_game.in_checkmate()) {
    return 'Checkmate!';
  } else if (shared_game.in_stalemate()) {
    return 'Stalemate...';
  } else {
    return 'Game Over';
  }
}

function getSquares () {
  return ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8'];
}

// add fog of war to board, which only shows which enemy pieces in range of our attacks
function showFogOfWar (shared_game, board) {
  let visible_game = new Chess();
  visible_game.clear();
  // show fog of war
  let attackable = getAttackableSquares(shared_game, HUMAN_COLOR);
  getSquares().forEach(function(square) {
    const piece = shared_game.get(square);
    if (piece && (piece.color == HUMAN_COLOR || attackable.has(square))) {
      // can see pieces that are ourself and attackable squares
      visible_game.put(piece, square);
    }

    let $square = $('#board .square-' + square);
    let background = ''
    if ((!piece || piece.color == AI_COLOR) && !attackable.has(square)) {
      // set fog of war if not our square and can't attack
      background = $square.hasClass('black-3c85d') ? DARK_FOG_COLOR : LIGHT_FOG_COLOR;
    }
    $square.css('background', background);
  });
  // show visible pieces
  board.position(visible_game.fen(), false);
}

// get squares attackable by given color
function getAttackableSquares (game, color) {
  let attackable = new Set();
  // legal set to false so will ignore King in check
  getGameWithTurn(game, color)
    .moves({ verbose: true, legal: false })
      .forEach(function(move) {
        attackable.add(move.to);
      });
  return attackable;
}

// Get a game with current turn of the given color.
function getGameWithTurn (game, color) {
  if (game.turn() == color) {
    // already the expected turn, so nothing to do
    return game;
  } else {
    // Warning! some hacks here to use the Chess engine in a different way then designed.
    // Change turn by copying the positions and overriding the current player turn.
    let fen_tokens = game.fen().split(' ');
    fen_tokens[1] = color;
    fen_tokens[3] = '-'; // clear en-passant status, which would prevent move generation
    return new Chess(fen_tokens.join(' '));
  }
}

function decideAiMove (shared_game, ai_game, board) {
  // create chess instance with what can be seen
  ai_game.load(getGameWithTurn(ai_game, AI_COLOR).fen());
  updateAiState(shared_game, ai_game);

  const engine = new Engine(ai_game.fen());
  const engine_moves = engine.board.calculateAiMoves(AI_LEVEL);
  for (let i = 0; i < engine_moves.length; i++) {
    const engine_move = {from: engine_moves[i].from.toLowerCase(), to: engine_moves[i].to.toLowerCase()};
    if (shared_game.move(engine_move)) {
      ai_game.move(engine_move);
      updateAiState(shared_game, ai_game);
      //console.log("AI game after", ai_game.ascii());
      return nextTurn(shared_game, ai_game, board);
    }
  }
  console.log("No AI moves so choose random");
  const possible_moves = shared_game.moves({ verbose: true });
  const randomIdx = Math.floor(Math.random() * possible_moves.length);
  shared_game.move(possible_moves[randomIdx].san);
}

// Update AI game view with latest information from attackable squares.
function updateAiState (shared_game, ai_game) {
  let attackable = getAttackableSquares(shared_game, AI_COLOR);
  getSquares().forEach(function(square) {
    const shared_piece = shared_game.get(square);
    const ai_piece = ai_game.get(square);
    // shared state has AI piece
    if (shared_piece && shared_piece.color == AI_COLOR) {
      if (!ai_game.put(shared_piece, square)) {
        console.log("failed to put AI piece");
      }
    } 
    // shared state is not AI piece but AI state is
    else if (ai_piece && ai_piece.color == AI_COLOR) {
      ai_game.remove(square);
    }
    
    // square is attackable so AI knows the state
    if (attackable.has(square)) {
      // square is blank
      if (!shared_piece) {
        ai_game.remove(square);
      } else if (shared_piece.color == HUMAN_COLOR) {
        if (!ai_game.put(shared_piece, square)) {
          console.log("failed to put human piece");
        }
      }
    }
  });
}

let prev_square; // keep track of square clicked for move
function onSquareClick($e, shared_game, ai_game, board) {
  let this_square = $e.data("square");
  const piece = shared_game.get(this_square);
  //console.log(prev_square, this_square, piece);
  if (piece && piece.color == HUMAN_COLOR) {
    // highlight just this piece and remove all other highlights
    $(".square-55d63").removeClass(HIGHLIGHT_CLASS);
    if (prev_square == this_square) {
      prev_square = null;
    } else {
      $e.addClass(HIGHLIGHT_CLASS);
      prev_square = this_square;
    }
  } else if (prev_square) {
    // already clicked a piece so check whether is a valid move
    if (shared_game.move({from: prev_square, to: this_square, promotion: 'q'})) {
      // is a legal move so clear the click state
      prev_square = null;
      $(".square-55d63").removeClass(HIGHLIGHT_CLASS);
      nextTurn(shared_game, ai_game, board);
    } else {
      console.log("failed human move:", prev_square, this_square);
    }  
  }
}

// get the max value in this object
function getMaxValue (obj) {
  let max_value = 0;
  for (const key in obj) {
    max_value = Math.max(obj[key], max_value);
  }
  return max_value;
}

function main() {
  // chess rules verified by https://github.com/jhlywa/chess.js
  let shared_game = new Chess(); // full game with all pieces
  let ai_game = new Chess(); // AI understanding of pieces
  // chessboard rendered with https://chessboardjs.com/
  let board = Chessboard('board', {
    position: 'start',
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
  });
  $("#board").on("click", ".square-55d63", function() {
    onSquareClick($(this), shared_game, ai_game, board);
  });
  nextTurn(shared_game, ai_game, board);
}

export { getMaxValue, main };
