
# 🧠 DriveStatusBar.jsx Module Instructions

This file outlines all the steps needed for GitHub Copilot (or a developer) to implement the `DriveStatusBar.jsx` component in the Strata Football scoring interface.

---

## 📁 File: `DriveStatusBar.jsx`

### 1. Import Dependencies
```
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { calculateRelativePosition } from '../utils/DownDistanceCalculator'; // Adjust path as needed
```

---

### 2. Define Component and Props
```
const DriveStatusBar = ({ gameId, currentDriveId, lastPlayNumber }) => {
  const [driveStats, setDriveStats] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
```

---

### 3. Load Drive Stats When Drive Changes
```
  useEffect(() => {
    if (!currentDriveId) return;
    fetch(`/php/load_drive_stats.php?drive_id=${currentDriveId}`)
      .then(res => res.json())
      .then(data => setDriveStats(data))
      .catch(err => console.error('Drive stats error:', err));
  }, [currentDriveId]);
```

---

### 4. Load Players from Last Play
```
  useEffect(() => {
    if (!lastPlayNumber) return;
    fetch(`/php/load_play_participants.php?game_id=${gameId}&play_number=${lastPlayNumber}`)
      .then(res => res.json())
      .then(data => setPlayerStats(data))
      .catch(err => console.error('Player stats error:', err));
  }, [lastPlayNumber, gameId]);
```

---

### 5. Display Logic
```
  if (!driveStats) return null;

  const {
    StartYardLine,
    EndYardLine,
    StartTime,
    EndTime,
    StartPlayNo,
    EndPlayNo
  } = driveStats;

  const yards = calculateRelativePosition(StartYardLine, EndYardLine);
  const playCount = driveStats.PlayCount || 0;
```

---

### 6. Render JSX Layout
```
  return (
    <div className="bg-gray-100 border-t border-b border-gray-300 py-2 px-4 text-sm flex justify-between items-center">
      <div className="font-semibold">
        Drive Summary: {yards} yards on {playCount} plays
      </div>
      <div className="text-right">
        <div className="font-semibold mb-1">Players in Last Play:</div>
        {playerStats.length === 0 ? (
          <div className="text-gray-500">None</div>
        ) : (
          playerStats.map((p, i) => (
            <div key={i}>
              #{p.Jersey} {p.Name} — {p.StatLine}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
```

---

### 7. Add Prop Validation
```
DriveStatusBar.propTypes = {
  gameId: PropTypes.number.isRequired,
  currentDriveId: PropTypes.number,
  lastPlayNumber: PropTypes.number,
};

export default DriveStatusBar;
```

---

## ✅ Requirements Recap

You must have these two PHP endpoints:

### 1. `/php/load_drive_stats.php`  
- **Input:** `drive_id` (GET)  
- **Returns:** JSON object with:  
  ```
  {
    StartYardLine,
    EndYardLine,
    StartTime,
    EndTime,
    StartPlayNo,
    EndPlayNo,
    PlayCount
  }
  ```

### 2. `/php/load_play_participants.php`  
- **Input:** `game_id` and `play_number` (GET)  
- **Returns:** JSON array:  
  ```
  [
    { Jersey, Name, StatLine },
    ...
  ]
  ```

---

## 📌 Notes

- `calculateRelativePosition()` is imported from your `DownDistanceCalculator.js` file.
- This module is **modularized** and reusable.
- This Drive Bar should be injected in the Input Container of your Game UI.

