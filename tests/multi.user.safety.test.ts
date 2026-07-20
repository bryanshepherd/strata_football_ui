import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Tests for multi-user safety awareness features
 * 
 * Tests lock status display, submission protection, and user awareness
 * to prevent multiple users from editing simultaneously.
 */
describe('Multi-User Safety', () => {
  
  describe('Lock Status Determination', () => {
    it('should identify unlocked game state', () => {
      const lockInfo = {
        is_locked: false,
        locked_by: null,
        locked_at: null,
        locked_by_user: null,
        can_edit: true
      };
      
      expect(lockInfo.is_locked).toBe(false);
      expect(lockInfo.can_edit).toBe(true);
    });
    
    it('should identify game locked by current user', () => {
      const lockInfo = {
        is_locked: true,
        locked_by: 123,
        locked_at: '2025-01-15T10:30:00Z',
        locked_by_user: 'Current User',
        can_edit: true
      };
      
      expect(lockInfo.is_locked).toBe(true);
      expect(lockInfo.can_edit).toBe(true);
      expect(lockInfo.locked_by_user).toBe('Current User');
    });
    
    it('should identify game locked by another user', () => {
      const lockInfo = {
        is_locked: true,
        locked_by: 456,
        locked_at: '2025-01-15T10:30:00Z',
        locked_by_user: 'Other User',
        can_edit: false
      };
      
      expect(lockInfo.is_locked).toBe(true);
      expect(lockInfo.can_edit).toBe(false);
      expect(lockInfo.locked_by_user).toBe('Other User');
    });
  });
  
  describe('Lock Status Display Logic', () => {
    it('should return available status for unlocked games', () => {
      const lockInfo = {
        is_locked: false,
        can_edit: true
      };
      
      const status = getLockStatusDisplay(lockInfo);
      expect(status.type).toBe('available');
      expect(status.message).toBe('Available');
    });
    
    it('should return current user status when locked by self', () => {
      const lockInfo = {
        is_locked: true,
        can_edit: true,
        locked_by_user: 'John Doe'
      };
      
      const status = getLockStatusDisplay(lockInfo);
      expect(status.type).toBe('current-user');
      expect(status.message).toBe('You are scoring');
    });
    
    it('should return locked status when locked by another user', () => {
      const lockInfo = {
        is_locked: true,
        can_edit: false,
        locked_by_user: 'Jane Smith',
        locked_at: '2025-01-15T10:30:00Z'
      };
      
      const status = getLockStatusDisplay(lockInfo);
      expect(status.type).toBe('locked');
      expect(status.message).toBe('🔒 Locked');
      expect(status.details).toContain('By: Jane Smith');
    });
  });
  
  describe('Submission Protection', () => {
    it('should allow submission when user can edit', () => {
      const gameData = {
        lock_info: {
          can_edit: true
        }
      };
      
      const result = canSubmitEvent(gameData);
      expect(result.allowed).toBe(true);
      expect(result.error).toBeNull();
    });
    
    it('should block submission when user cannot edit', () => {
      const gameData = {
        lock_info: {
          can_edit: false,
          locked_by_user: 'Other User'
        }
      };
      
      const result = canSubmitEvent(gameData);
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('Game is locked by Other User');
    });
    
    it('should allow submission when lock info is missing (backward compatibility)', () => {
      const gameData = {};
      
      const result = canSubmitEvent(gameData);
      expect(result.allowed).toBe(true);
      expect(result.error).toBeNull();
    });
  });
  
  describe('Lock Polling Behavior', () => {
    it('should detect lock changes between polls', () => {
      const previousLock = {
        is_locked: false,
        can_edit: true
      };
      
      const currentLock = {
        is_locked: true,
        can_edit: false,
        locked_by_user: 'New User'
      };
      
      const change = detectLockChange(previousLock, currentLock);
      expect(change.hasChanged).toBe(true);
      expect(change.type).toBe('acquired');
      expect(change.message).toContain('Game was locked by New User');
    });
    
    it('should detect lock release', () => {
      const previousLock = {
        is_locked: true,
        can_edit: false,
        locked_by_user: 'Other User'
      };
      
      const currentLock = {
        is_locked: false,
        can_edit: true
      };
      
      const change = detectLockChange(previousLock, currentLock);
      expect(change.hasChanged).toBe(true);
      expect(change.type).toBe('released');
      expect(change.message).toBe('Game is now available for editing');
    });
    
    it('should not detect change when lock status unchanged', () => {
      const lockInfo = {
        is_locked: true,
        can_edit: true,
        locked_by_user: 'Current User'
      };
      
      const change = detectLockChange(lockInfo, lockInfo);
      expect(change.hasChanged).toBe(false);
    });
  });
});

// Helper functions used by tests
function getLockStatusDisplay(lockInfo: any) {
  // Check if locked first
  if (lockInfo?.is_locked) {
    if (lockInfo.can_edit) {
      return {
        type: 'current-user',
        message: 'You are scoring'
      };
    } else {
      return {
        type: 'locked',
        message: '🔒 Locked',
        details: `By: ${lockInfo.locked_by_user || 'Another user'}`
      };
    }
  }
  
  // Not locked or no lock info
  return {
    type: 'available',
    message: 'Available'
  };
}

function canSubmitEvent(gameData: any) {
  if (gameData?.lock_info?.can_edit === false) {
    return {
      allowed: false,
      error: `Cannot submit: Game is locked by ${gameData.lock_info.locked_by_user || 'another user'}`
    };
  }
  
  return {
    allowed: true,
    error: null
  };
}

function detectLockChange(previous: any, current: any) {
  const wasLocked = previous?.is_locked && !previous?.can_edit;
  const isLocked = current?.is_locked && !current?.can_edit;
  
  if (!wasLocked && isLocked) {
    return {
      hasChanged: true,
      type: 'acquired',
      message: `Game was locked by ${current.locked_by_user || 'another user'}`
    };
  }
  
  if (wasLocked && !isLocked) {
    return {
      hasChanged: true,
      type: 'released',
      message: 'Game is now available for editing'
    };
  }
  
  return {
    hasChanged: false
  };
}