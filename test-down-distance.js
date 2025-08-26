/**
 * TEST SCRIPT for Down-Distance Calculator
 * Tests the new possession-relative algorithm with LineToGain approach
 */

import DownDistanceCalculator from './src/utils/DownDistanceCalculator.js';

// Test scenarios based on user requirements
const testScenarios = [
  {
    name: "Basic Rush - 5 yard gain",
    gameState: {
      YardLinePosition: "H25",
      CurrentDown: 1,
      YardsToGo: 10,
      LineToGain: "H35",
      Possession: "HOME"
    },
    playData: {
      finalYardLine: "H30",
      playType: "rush",
      isFirstDown: false,
      isTouchdown: false,
      isTurnover: false,
      isSafety: false
    },
    expected: {
      postDown: 2,
      postDistance: 5, // 10 - 5 gained
      driveEnds: false
    }
  },
  
  {
    name: "First Down Achieved",
    gameState: {
      YardLinePosition: "H25",
      CurrentDown: 2,
      YardsToGo: 5,
      LineToGain: "H30",
      Possession: "HOME"
    },
    playData: {
      finalYardLine: "H32",
      playType: "pass",
      isFirstDown: true, // Achieved first down
      isTouchdown: false,
      isTurnover: false,
      isSafety: false
    },
    expected: {
      postDown: 1,
      postDistance: 10, // Reset to 1st and 10
      driveEnds: false
    }
  },
  
  {
    name: "Touchdown - Drive Ends",
    gameState: {
      YardLinePosition: "V10",
      CurrentDown: 1,
      YardsToGo: 10,
      LineToGain: "V00",
      Possession: "HOME"
    },
    playData: {
      finalYardLine: "V00",
      playType: "rush",
      isFirstDown: false,
      isTouchdown: true,
      isTurnover: false,
      isSafety: false
    },
    expected: {
      postDown: null,
      postDistance: null,
      driveEnds: true,
      driveResult: "TOUCHDOWN"
    }
  },
  
  {
    name: "Failed 4th Down - Turnover on Downs",
    gameState: {
      YardLinePosition: "H45",
      CurrentDown: 4,
      YardsToGo: 2,
      LineToGain: "H47",
      Possession: "HOME"
    },
    playData: {
      finalYardLine: "H46", // Only gained 1 yard, needed 2
      playType: "rush",
      isFirstDown: false,
      isTouchdown: false,
      isTurnover: false,
      isSafety: false
    },
    expected: {
      postDown: null,
      postDistance: null,
      driveEnds: true,
      driveResult: "TURNOVER_ON_DOWNS"
    }
  },
  
  {
    name: "Interception - Drive Ends",
    gameState: {
      YardLinePosition: "V30",
      CurrentDown: 2,
      YardsToGo: 5,
      LineToGain: "V25",
      Possession: "HOME"
    },
    playData: {
      finalYardLine: "V35", // Where intercepted
      playType: "pass",
      isFirstDown: false,
      isTouchdown: false,
      isTurnover: true,
      isSafety: false
    },
    expected: {
      postDown: null,
      postDistance: null,
      driveEnds: true,
      driveResult: "INTERCEPTION"
    }
  }
];

// Run tests
function runTests() {
  console.log("🏈 TESTING DOWN-DISTANCE CALCULATOR");
  console.log("=====================================\n");
  
  let passed = 0;
  let failed = 0;
  
  testScenarios.forEach((scenario, index) => {
    console.log(`Test ${index + 1}: ${scenario.name}`);
    console.log("Input:", scenario.gameState, scenario.playData);
    
    const result = DownDistanceCalculator.calculatePostPlayState(
      scenario.playData, 
      scenario.gameState
    );
    
    console.log("Result:", result);
    console.log("Expected:", scenario.expected);
    
    // Check key expectations
    let testPassed = true;
    const checks = [
      ['postDown', result.postDown, scenario.expected.postDown],
      ['postDistance', result.postDistance, scenario.expected.postDistance],
      ['driveEnds', result.driveEnds, scenario.expected.driveEnds],
      ['driveResult', result.driveResult, scenario.expected.driveResult]
    ];
    
    checks.forEach(([field, actual, expected]) => {
      if (expected !== undefined && actual !== expected) {
        console.log(`  ❌ ${field}: expected ${expected}, got ${actual}`);
        testPassed = false;
      }
    });
    
    if (testPassed) {
      console.log("  ✅ PASS");
      passed++;
    } else {
      console.log("  ❌ FAIL");
      failed++;
    }
    
    console.log("\n");
  });
  
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log("🎉 ALL TESTS PASSED!");
  }
}

// Test possession-relative algorithm specifically
function testPossessionRelative() {
  console.log("🔢 TESTING POSSESSION-RELATIVE ALGORITHM");
  console.log("=========================================\n");
  
  const tests = [
    // HOME team scenarios
    {team: "HOME", pos: "H25", expected: 25, desc: "HOME at own 25"},
    {team: "HOME", pos: "V25", expected: 75, desc: "HOME at opponent 25"},
    {team: "HOME", pos: "V01", expected: 99, desc: "HOME at opponent 1 (red zone)"},
    
    // VISITOR team scenarios
    {team: "VISITOR", pos: "V25", expected: 25, desc: "VISITOR at own 25"},
    {team: "VISITOR", pos: "H25", expected: 75, desc: "VISITOR at opponent 25"},
    {team: "VISITOR", pos: "H01", expected: 99, desc: "VISITOR at opponent 1 (red zone)"},
  ];
  
  tests.forEach(test => {
    const result = DownDistanceCalculator.toPossessionRelative(test.pos, test.team);
    const status = result === test.expected ? "✅" : "❌";
    console.log(`${status} ${test.desc}: ${test.pos} → ${result} (expected ${test.expected})`);
  });
}

// Run all tests
runTests();
testPossessionRelative();

export { runTests, testPossessionRelative };
