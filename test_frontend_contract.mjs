// Test the frontend data contract transformations
import { DataTransformer, DataValidator } from '../src/utils/apiDataContract.ts';

console.log('=== FRONTEND DATA CONTRACT TEST ===\n');

// Test 1: Frontend play data transformation
console.log('1. Testing Frontend Play Data Transformation:');
const testPlayData = {
  playType: "pass",
  passer: "12",
  receiver: "88", 
  result: "C",
  yardsGained: 15,
  sackYards: 0,
  spot: "H45"
};

const standardized = DataTransformer.transformPlayData(testPlayData);
console.log('Original:', testPlayData);
console.log('Standardized:', standardized);

// Test 2: Validation
console.log('\n2. Testing Frontend Data Validation:');
const validation = DataValidator.validatePlayData(standardized);
console.log('Validation result:', validation);

// Test 3: Game state transformation
console.log('\n3. Testing Frontend Game State Transformation:');
const gameState = {
  gameId: 123,
  quarter: 3,
  clock: "8:45",
  possession: "V",
  down: 2,
  distance: 7,
  spot: "V32",
  score: { H: 21, V: 14 }
};

const standardizedGameState = DataTransformer.transformGameState(gameState);
console.log('Original game state:', gameState);
console.log('Standardized game state:', standardizedGameState);

console.log('\n=== FRONTEND TEST COMPLETE ===');
