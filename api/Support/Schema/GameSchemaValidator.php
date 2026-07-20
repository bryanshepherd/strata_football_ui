<?php

namespace Strata\Football\Api\Support\Schema;

use function array_key_exists;
use function in_array;
use function is_array;
use function is_bool;
use function is_int;
use function is_string;
use function preg_match;

class GameSchemaValidator implements SchemaValidatorInterface
{
    public function __construct()
    {
    }

    public static function fromFile(string $schemaPath): self
    {
        if (!is_file($schemaPath)) {
            throw new SchemaValidationException('Game schema not found at ' . $schemaPath);
        }

        return new self();
    }

    public function validate(array $payload, ?string $resourceId = null): void
    {
        if (!isset($payload['game']) || !is_array($payload['game'])) {
            throw new SchemaValidationException($this->prefix($resourceId, 'Payload missing "game" object'));
        }

        $game = $payload['game'];

        $this->validateVenue($game['venue'] ?? null, $resourceId);
        $this->validateOfficials($game['officials'] ?? null, $resourceId);
        $this->validateRules($game['rules'] ?? null, $resourceId);
        $this->validateLiveController($game['liveController'] ?? null, $resourceId);
        $this->validatePlays($game['plays'] ?? null, $resourceId);
    }

    /**
     * @param mixed $venue
     */
    private function validateVenue($venue, ?string $resourceId): void
    {
        $data = $this->requireArray($venue, $this->prefix($resourceId, 'game.venue'));
        $path = $this->prefix($resourceId, 'game.venue');

        foreach (['gameId', 'visId', 'homeId', 'visName', 'homeName'] as $key) {
            $this->assertHasKey($data, $key, $path);
            $this->assertString($data[$key], $path . '.' . $key);
        }

        $this->assertDateString($data['date'] ?? null, $path . '.date', true);
        $this->assertNullableString($data['location'] ?? null, $path . '.location');
        $this->assertNullableString($data['stadium'] ?? null, $path . '.stadium');
        $this->assertDateTimeString($data['start'] ?? null, $path . '.start', true);
        $this->assertDateTimeString($data['end'] ?? null, $path . '.end', true);
        $this->assertBoolean($data['isLeagueGame'] ?? null, $path . '.isLeagueGame', true);
        $this->assertInteger($data['duration'] ?? null, $path . '.duration', true, 0);
        $this->assertInteger($data['attendance'] ?? null, $path . '.attendance', true, 0);
        $this->assertInteger($data['temperature'] ?? null, $path . '.temperature', true);
        $this->assertNullableString($data['wind'] ?? null, $path . '.wind');
        $this->assertNullableString($data['weather'] ?? null, $path . '.weather');
    }

    /**
     * @param mixed $officials
     */
    private function validateOfficials($officials, ?string $resourceId): void
    {
        $data = $this->requireArray($officials, $this->prefix($resourceId, 'game.officials'));
        $path = $this->prefix($resourceId, 'game.officials');

        foreach ([
            'ref',
            'ump',
            'headLinesman',
            'lineJudge',
            'backJudge',
            'fieldJudge',
            'sideJudge',
            'centerJudge',
            'replay',
            'scorer'
        ] as $key) {
            if (array_key_exists($key, $data)) {
                $this->assertNullableString($data[$key], $path . '.' . $key);
            }
        }
    }

    /**
     * @param mixed $rules
     */
    private function validateRules($rules, ?string $resourceId): void
    {
        $data = $this->requireArray($rules, $this->prefix($resourceId, 'game.rules'));
        $path = $this->prefix($resourceId, 'game.rules');

        $this->assertInteger($data['quarters'] ?? null, $path . '.quarters', false, 1);
        $this->assertInteger($data['minutesPerQuarter'] ?? null, $path . '.minutesPerQuarter', false, 1);
        $this->assertInteger($data['downs'] ?? null, $path . '.downs', false, 1);
        $this->assertInteger($data['yardsToFirstDown'] ?? null, $path . '.yardsToFirstDown', false, 1);
        $this->assertInteger($data['koSpot'] ?? null, $path . '.koSpot', false, 0);
        $this->assertInteger($data['tbSpot'] ?? null, $path . '.tbSpot', false, 0);
        $this->assertInteger($data['koTbSpot'] ?? null, $path . '.koTbSpot', false, 0);
        $this->assertInteger($data['patSpot'] ?? null, $path . '.patSpot', false, 0);
        $this->assertInteger($data['safetySpot'] ?? null, $path . '.safetySpot', false, 0);
        $this->assertInteger($data['touchdownPoints'] ?? null, $path . '.touchdownPoints');
        $this->assertInteger($data['fieldGoalPoints'] ?? null, $path . '.fieldGoalPoints');
        $this->assertInteger($data['patKickPoints'] ?? null, $path . '.patKickPoints');
        $this->assertInteger($data['patConversionPoints'] ?? null, $path . '.patConversionPoints');
        $this->assertInteger($data['safetyPoints'] ?? null, $path . '.safetyPoints');
        $this->assertInteger($data['defensivePatPoints'] ?? null, $path . '.defensivePatPoints');
        $this->assertInteger($data['rougePoints'] ?? null, $path . '.rougePoints');
        $this->assertInteger($data['fieldLength'] ?? null, $path . '.fieldLength', false, 1);
    }

    /**
     * @param mixed $controller
     */
    private function validateLiveController($controller, ?string $resourceId): void
    {
        if ($controller === null) {
            return;
        }

        $data = $this->requireArray($controller, $this->prefix($resourceId, 'game.liveController'));
        $path = $this->prefix($resourceId, 'game.liveController');

        if (array_key_exists('hasball', $data)) {
            $this->assertEnum($data['hasball'], $path . '.hasball', ['H', 'V'], true);
        }

        $this->assertNullableString($data['id'] ?? null, $path . '.id');
        $this->assertInteger($data['down'] ?? null, $path . '.down', true, 1, 4);
        $this->assertInteger($data['togo'] ?? null, $path . '.togo', true, 0);
        $this->assertSpotString($data['spot'] ?? null, $path . '.spot', true);
        $this->assertNullableString($data['context'] ?? null, $path . '.context', '/^[HV],[0-9]+,[0-9]+,[HV][0-9]{1,2}$/');
        $this->assertInteger($data['qtr'] ?? null, $path . '.qtr', true, 1);
        $this->assertClock($data['clock'] ?? null, $path . '.clock', true);
        $this->assertInteger($data['vtoh'] ?? null, $path . '.vtoh', true, 0, 3);
        $this->assertInteger($data['htoh'] ?? null, $path . '.htoh', true, 0, 3);
        $this->assertNullableString($data['lastplay'] ?? null, $path . '.lastplay');
        $this->assertEnum($data['status'] ?? null, $path . '.status', ['pregame', 'active', 'halftime', 'final', 'suspended'], true);
        $this->assertEnum($data['flag'] ?? null, $path . '.flag', ['N', 'Y'], true);
        $this->assertEnum($data['review'] ?? null, $path . '.review', ['N', 'Y'], true);
        $this->assertInteger($data['drivenum'] ?? null, $path . '.drivenum', true, 0);
    }

    /**
     * @param mixed $plays
     */
    private function validatePlays($plays, ?string $resourceId): void
    {
        $list = $this->requireArray($plays, $this->prefix($resourceId, 'game.plays'));
        $path = $this->prefix($resourceId, 'game.plays');

        if ($list === []) {
            throw new SchemaValidationException($path . ' must contain at least one play');
        }

        foreach ($list as $index => $play) {
            $this->validatePlay($play, $index, $resourceId);
        }
    }

    /**
     * @param mixed $play
     */
    private function validatePlay($play, int $index, ?string $resourceId): void
    {
        $path = $this->prefix($resourceId, 'game.plays[' . $index . ']');
        $data = $this->requireArray($play, $path);

        $this->assertHasKey($data, 'playId', $path);
        $this->assertString($data['playId'], $path . '.playId');

        if (array_key_exists('sequenceKey', $data)) {
            $this->assertNullableString($data['sequenceKey'], $path . '.sequenceKey', '/^[0-9]+-[0-9]+-[0-9-]+$/');
        }

        $this->assertHasKey($data, 'context', $path);
        $this->validateContext($data['context'], $path . '.context');

        $this->assertHasKey($data, 'events', $path);
        $events = $this->requireArray($data['events'], $path . '.events');

        if ($events === []) {
            throw new SchemaValidationException($path . '.events must contain at least one entry');
        }

        foreach ($events as $eventIndex => $event) {
            $this->validateEvent($event, $path . '.events[' . $eventIndex . ']');
        }

        if (array_key_exists('generated', $data)) {
            $this->validateGenerated($data['generated'], $path . '.generated');
        }

        if (array_key_exists('expansions', $data)) {
            $this->requireArray($data['expansions'], $path . '.expansions');
        }

        $this->assertHasKey($data, 'score', $path);
        $this->validateScore($data['score'], $path . '.score');

        $this->assertHasKey($data, 'newContext', $path);
        $this->validateContext($data['newContext'], $path . '.newContext');
    }

    /**
     * @param mixed $context
     */
    private function validateContext($context, string $path): void
    {
        $data = $this->requireArray($context, $path);

        foreach (['hasBall', 'down', 'toGo', 'spot', 'qtr'] as $key) {
            $this->assertHasKey($data, $key, $path);
        }

        $this->assertEnum($data['hasBall'], $path . '.hasBall', ['H', 'V']);
        $this->assertInteger($data['down'], $path . '.down', false, 1, 4);
        $this->assertInteger($data['toGo'], $path . '.toGo', false, 0);
        $this->assertSpotString($data['spot'], $path . '.spot');
        if (array_key_exists('clock', $data)) {
            $this->assertClock($data['clock'], $path . '.clock', true);
        }
        $this->assertInteger($data['qtr'], $path . '.qtr', false, 1);
    }

    /**
     * @param mixed $score
     */
    private function validateScore($score, string $path): void
    {
        $data = $this->requireArray($score, $path);

        foreach (['isScoringPlay', 'homeScore', 'awayScore', 'teamScored', 'pointsAdded'] as $key) {
            $this->assertHasKey($data, $key, $path);
        }

        $this->assertBoolean($data['isScoringPlay'], $path . '.isScoringPlay');
        $this->assertInteger($data['homeScore'], $path . '.homeScore', false, 0);
        $this->assertInteger($data['awayScore'], $path . '.awayScore', false, 0);
        $this->assertEnum($data['teamScored'], $path . '.teamScored', ['H', 'V'], true);
        $this->assertInteger($data['pointsAdded'], $path . '.pointsAdded');
    }

    /**
     * @param mixed $generated
     */
    private function validateGenerated($generated, string $path): void
    {
        $data = $this->requireArray($generated, $path);

        if (array_key_exists('isThirdDown', $data)) {
            $this->assertEnum($data['isThirdDown'], $path . '.isThirdDown', ['false', 'failed', 'converted', 'nullified'], true, true);
        }

        if (array_key_exists('isFourthDown', $data)) {
            $this->assertEnum($data['isFourthDown'], $path . '.isFourthDown', ['false', 'failed', 'converted', 'nullified'], true, true);
        }

        if (array_key_exists('isFirstDown', $data)) {
            $this->assertEnum($data['isFirstDown'], $path . '.isFirstDown', ['rush', 'pass', 'penalty'], true);
        }

        if (array_key_exists('isGoalToGo', $data)) {
            $this->assertBoolean($data['isGoalToGo'], $path . '.isGoalToGo');
        }
    }

    /**
     * @param mixed $event
     */
    private function validateEvent($event, string $path): void
    {
        $data = $this->requireArray($event, $path);

        if ($data === []) {
            throw new SchemaValidationException($path . ' must contain at least one payload block');
        }

        foreach ($data as $key => $payload) {
            if (!is_array($payload)) {
                throw new SchemaValidationException($path . '.' . $key . ' must be an object');
            }

            switch ($key) {
                case 'rush':
                    $this->validateRushEvent($payload, $path . '.rush');
                    break;
                case 'pass':
                    $this->validatePassEvent($payload, $path . '.pass');
                    break;
                case 'receive':
                    $this->validateReceiveEvent($payload, $path . '.receive');
                    break;
                case 'return':
                    $this->validateReturnEvent($payload, $path . '.return');
                    break;
                case 'penalty':
                    $this->validatePenaltyEvent($payload, $path . '.penalty');
                    break;
                case 'freekick':
                    $this->validateFreekickEvent($payload, $path . '.freekick');
                    break;
                case 'punt':
                    $this->validatePuntEvent($payload, $path . '.punt');
                    break;
                case 'fieldgoal':
                    $this->validateFieldGoalEvent($payload, $path . '.fieldgoal');
                    break;
                case 'pat':
                    $this->validatePatEvent($payload, $path . '.pat');
                    break;
                case 'tackle':
                    $this->validateTackleEvent($payload, $path . '.tackle');
                    break;
                case 'fumble':
                    $this->validateFumbleEvent($payload, $path . '.fumble');
                    break;
                case 'sack':
                    $this->validateSackEvent($payload, $path . '.sack');
                    break;
                case 'gameControl':
                    $this->validateGameControlPayload($payload, $path . '.gameControl');
                    break;
                default:
                    // Allow future event payloads but ensure they remain structured objects.
                    $this->requireArray($payload, $path . '.' . $key);
                    break;
            }
        }
    }

    private function validateRushEvent(array $payload, string $path): void
    {
        if (array_key_exists('rusher', $payload)) {
            $this->assertNullableString($payload['rusher'], $path . '.rusher');
        }

        if (array_key_exists('endSpot', $payload)) {
            $this->assertSpotString($payload['endSpot'], $path . '.endSpot', true);
        }
    }

    private function validatePassEvent(array $payload, string $path): void
    {
        if (array_key_exists('passer', $payload)) {
            $this->assertNullableString($payload['passer'], $path . '.passer');
        }

        if (array_key_exists('target', $payload)) {
            $this->assertNullableString($payload['target'], $path . '.target');
        }

        if (array_key_exists('result', $payload)) {
            $this->assertNullableString($payload['result'], $path . '.result');
        }

        if (array_key_exists('targetSpot', $payload)) {
            $this->assertSpotString($payload['targetSpot'], $path . '.targetSpot', true);
        }

        if (array_key_exists('passBreak', $payload)) {
            $this->assertNullableString($payload['passBreak'], $path . '.passBreak');
        }

        if (array_key_exists('qbHurry', $payload)) {
            $this->assertNullableString($payload['qbHurry'], $path . '.qbHurry');
        }
    }

    private function validateReceiveEvent(array $payload, string $path): void
    {
        if (array_key_exists('receiver', $payload)) {
            $this->assertNullableString($payload['receiver'], $path . '.receiver');
        }

        if (array_key_exists('receiveSpot', $payload)) {
            $this->assertSpotString($payload['receiveSpot'], $path . '.receiveSpot', true);
        }

        if (array_key_exists('endSpot', $payload)) {
            $this->assertSpotString($payload['endSpot'], $path . '.endSpot', true);
        }
    }

    private function validateReturnEvent(array $payload, string $path): void
    {
        if (array_key_exists('type', $payload)) {
            $this->assertEnum($payload['type'], $path . '.type', ['Fumble', 'Interception', 'Field Goal', 'Kick', 'Punt'], true);
        }

        if (array_key_exists('returner', $payload)) {
            $this->assertNullableString($payload['returner'], $path . '.returner');
        }

        if (array_key_exists('fromSpot', $payload)) {
            $this->assertSpotString($payload['fromSpot'], $path . '.fromSpot', true);
        }

        if (array_key_exists('toSpot', $payload)) {
            $this->assertSpotString($payload['toSpot'], $path . '.toSpot', true);
        }
    }

    private function validatePenaltyEvent(array $payload, string $path): void
    {
        if (array_key_exists('code', $payload)) {
            $this->assertString($payload['code'], $path . '.code');
        }

        if (array_key_exists('foulOn', $payload)) {
            $this->assertNullableString($payload['foulOn'], $path . '.foulOn');
        }

        if (array_key_exists('enforcement', $payload)) {
            $this->assertEnum($payload['enforcement'], $path . '.enforcement', ['Accepted', 'Declined', 'Offsetting'], true);
        }

        if (array_key_exists('enforceFrom', $payload)) {
            $this->assertSpotString($payload['enforceFrom'], $path . '.enforceFrom', true);
        }

        if (array_key_exists('enforceTo', $payload)) {
            $this->assertSpotString($payload['enforceTo'], $path . '.enforceTo', true);
        }

        if (array_key_exists('ejectPlayer', $payload)) {
            $this->assertBoolean($payload['ejectPlayer'], $path . '.ejectPlayer', true);
        }

        if (array_key_exists('isPlayNull', $payload)) {
            $this->assertBoolean($payload['isPlayNull'], $path . '.isPlayNull', true);
        }

        if (array_key_exists('isFirstDown', $payload)) {
            $this->assertBoolean($payload['isFirstDown'], $path . '.isFirstDown', true);
        }
    }

    private function validateFreekickEvent(array $payload, string $path): void
    {
        if (array_key_exists('kicker', $payload)) {
            $this->assertNullableString($payload['kicker'], $path . '.kicker');
        }

        if (array_key_exists('kickedTo', $payload)) {
            $this->assertSpotString($payload['kickedTo'], $path . '.kickedTo', true);
        }

        $this->assertOptionalBoolean($payload, 'isTouchback', $path . '.isTouchback');
        $this->assertOptionalBoolean($payload, 'isOB', $path . '.isOB');
        $this->assertOptionalBoolean($payload, 'isOnside', $path . '.isOnside');
    }

    private function validatePuntEvent(array $payload, string $path): void
    {
        if (array_key_exists('punter', $payload)) {
            $this->assertNullableString($payload['punter'], $path . '.punter');
        }

        if (array_key_exists('kickedTo', $payload)) {
            $this->assertSpotString($payload['kickedTo'], $path . '.kickedTo', true);
        }

        $this->assertOptionalBoolean($payload, 'isTouchback', $path . '.isTouchback');
        $this->assertOptionalBoolean($payload, 'isFairCatch', $path . '.isFairCatch');
        if (array_key_exists('fairCatchBy', $payload)) {
            $this->assertNullableString($payload['fairCatchBy'], $path . '.fairCatchBy');
        }
        $this->assertOptionalBoolean($payload, 'isOB', $path . '.isOB');
    }

    private function validateFieldGoalEvent(array $payload, string $path): void
    {
        if (array_key_exists('kicker', $payload)) {
            $this->assertNullableString($payload['kicker'], $path . '.kicker');
        }

        if (array_key_exists('spotOfKick', $payload)) {
            $this->assertSpotString($payload['spotOfKick'], $path . '.spotOfKick', true);
        }

        if (array_key_exists('result', $payload)) {
            $this->assertEnum($payload['result'], $path . '.result', ['good', 'missed', 'blocked', 'noGood'], true);
        }

        $this->assertClock($payload['clock'] ?? null, $path . '.clock', true);
        $this->assertInteger($payload['qtr'] ?? null, $path . '.qtr', true, 1);
    }

    private function validatePatEvent(array $payload, string $path): void
    {
        if (array_key_exists('type', $payload)) {
            $this->assertEnum($payload['type'], $path . '.type', ['kick', 'rush', 'pass', 'def'], true);
        }

        if (array_key_exists('playerId', $payload)) {
            $this->assertNullableString($payload['playerId'], $path . '.playerId');
        }

        if (array_key_exists('result', $payload)) {
            $this->assertEnum($payload['result'], $path . '.result', ['good', 'missed', 'blocked', 'fumbled', 'intercepted'], true);
        }
    }

    private function validateTackleEvent(array $payload, string $path): void
    {
        if (array_key_exists('tackleA', $payload)) {
            $this->assertNullableString($payload['tackleA'], $path . '.tackleA');
        }

        if (array_key_exists('tackleB', $payload)) {
            $this->assertNullableString($payload['tackleB'], $path . '.tackleB');
        }
    }

    private function validateFumbleEvent(array $payload, string $path): void
    {
        if (array_key_exists('forcedBy', $payload)) {
            $this->assertNullableString($payload['forcedBy'], $path . '.forcedBy');
        }

        if (array_key_exists('recoverTeam', $payload)) {
            $this->assertEnum($payload['recoverTeam'], $path . '.recoverTeam', ['H', 'V'], true);
        }

        if (array_key_exists('recoverPlayer', $payload)) {
            $this->assertNullableString($payload['recoverPlayer'], $path . '.recoverPlayer');
        }

        if (array_key_exists('recoverSpot', $payload)) {
            $this->assertSpotString($payload['recoverSpot'], $path . '.recoverSpot', true);
        }
    }

    private function validateSackEvent(array $payload, string $path): void
    {
        if (array_key_exists('sackerA', $payload)) {
            $this->assertNullableString($payload['sackerA'], $path . '.sackerA');
        }

        if (array_key_exists('sackerB', $payload)) {
            $this->assertNullableString($payload['sackerB'], $path . '.sackerB');
        }

        if (array_key_exists('endSpot', $payload)) {
            $this->assertSpotString($payload['endSpot'], $path . '.endSpot', true);
        }
    }

    private function validateGameControlPayload(array $payload, string $path): void
    {
        $this->assertHasKey($payload, 'type', $path);
        $this->assertEnum($payload['type'], $path . '.type', [
            'timeout',
            'driveStart',
            'driveEnd',
            'comment',
            'possessionChange',
            'contextEdit',
            'quarterAdvance',
            'review',
            'delay',
            'uniformChange',
            'halfEnd'
        ]);

        if (array_key_exists('team', $payload)) {
            $this->assertEnum($payload['team'], $path . '.team', ['H', 'V'], true);
        }

        $this->assertInteger($payload['driveNumber'] ?? null, $path . '.driveNumber', true, 0);
        $this->assertSpotString($payload['spot'] ?? null, $path . '.spot', true);
        $this->assertClock($payload['clock'] ?? null, $path . '.clock', true);
        $this->assertInteger($payload['qtr'] ?? null, $path . '.qtr', true, 1);

        $this->assertEnum($payload['howStart'] ?? null, $path . '.howStart', [
            'Kickoff',
            'Punt',
            'Fumble',
            'Interception',
            'Downs',
            'Safety',
            'Possession',
            'Blocked Field Goal'
        ], true);

        $this->assertEnum($payload['howEnd'] ?? null, $path . '.howEnd', [
            'Touchdown',
            'Field Goal',
            'Punt',
            'Downs',
            'Fumble',
            'Interception',
            'Safety',
            'Blocked Field Goal',
            'End of Half',
            'End of Game'
        ], true);

        $this->assertNullableString($payload['timeoutType'] ?? null, $path . '.timeoutType');
        $this->assertNullableString($payload['instruction'] ?? null, $path . '.instruction');
        $this->assertBoolean($payload['isManual'] ?? null, $path . '.isManual', true);
        $this->assertInteger($payload['down'] ?? null, $path . '.down', true, 1, 4);
        $this->assertInteger($payload['toGo'] ?? null, $path . '.toGo', true, 0);
        $this->assertEnum($payload['reviewType'] ?? null, $path . '.reviewType', ['Home', 'Away', 'Official'], true);
        $this->assertEnum($payload['result'] ?? null, $path . '.result', ['Confirmed', 'Upheld', 'Overturned'], true);
        $this->assertNullableString($payload['reason'] ?? null, $path . '.reason');

        if (array_key_exists('correctedPlay', $payload) && $payload['correctedPlay'] !== null) {
            $list = $this->requireArray($payload['correctedPlay'], $path . '.correctedPlay');
            foreach ($list as $index => $item) {
                $this->assertString($item, $path . '.correctedPlay[' . $index . ']');
            }
        }

        $this->assertNullableString($payload['delayType'] ?? null, $path . '.delayType');
        $this->assertDateTimeString($payload['timeStarted'] ?? null, $path . '.timeStarted', true);
        $this->assertDateTimeString($payload['timeEnded'] ?? null, $path . '.timeEnded', true);
        $this->assertNullableString($payload['playerId'] ?? null, $path . '.playerId');
        $this->assertNullableString($payload['oldNumber'] ?? null, $path . '.oldNumber');
        $this->assertNullableString($payload['newNumber'] ?? null, $path . '.newNumber');
    }

    private function assertOptionalBoolean(array $payload, string $key, string $path): void
    {
        if (array_key_exists($key, $payload)) {
            $this->assertBoolean($payload[$key], $path, true);
        }
    }

    /**
     * @param mixed $value
     * @return array<mixed>
     */
    private function requireArray($value, string $path): array
    {
        if (!is_array($value)) {
            throw new SchemaValidationException($path . ' must be an object/array');
        }

        return $value;
    }

    private function assertHasKey(array $data, string $key, string $path): void
    {
        if (!array_key_exists($key, $data)) {
            throw new SchemaValidationException($path . ' missing required key "' . $key . '"');
        }
    }

    /**
     * @param mixed $value
     */
    private function assertString($value, string $path): void
    {
        if (!is_string($value)) {
            throw new SchemaValidationException($path . ' must be a string');
        }
    }

    /**
     * @param mixed $value
     */
    private function assertNullableString($value, string $path, ?string $pattern = null): void
    {
        if ($value === null) {
            return;
        }

        $this->assertString($value, $path);

        if ($pattern !== null && !preg_match($pattern, $value)) {
            throw new SchemaValidationException($path . ' does not match expected format');
        }
    }

    /**
     * @param mixed $value
     */
    private function assertBoolean($value, string $path, bool $nullable = false): void
    {
        if ($value === null && $nullable) {
            return;
        }

        if (!is_bool($value)) {
            throw new SchemaValidationException($path . ' must be a boolean');
        }
    }

    /**
     * @param mixed $value
     */
    private function assertInteger($value, string $path, bool $nullable = false, ?int $min = null, ?int $max = null): void
    {
        if ($value === null && $nullable) {
            return;
        }

        if (!is_int($value)) {
            throw new SchemaValidationException($path . ' must be an integer');
        }

        if ($min !== null && $value < $min) {
            throw new SchemaValidationException($path . ' must be >= ' . $min);
        }

        if ($max !== null && $value > $max) {
            throw new SchemaValidationException($path . ' must be <= ' . $max);
        }
    }

    /**
     * @param mixed $value
     * @param array<int, string> $allowed
     */
    private function assertEnum($value, string $path, array $allowed, bool $nullable = false, bool $allowBooleanFalse = false): void
    {
        if ($value === null && $nullable) {
            return;
        }

        if ($allowBooleanFalse && $value === false) {
            return;
        }

        if (!is_string($value)) {
            throw new SchemaValidationException($path . ' must be one of: ' . implode(', ', $allowed));
        }

        if (!in_array($value, $allowed, true)) {
            throw new SchemaValidationException($path . ' must be one of: ' . implode(', ', $allowed));
        }
    }

    /**
     * @param mixed $value
     */
    private function assertSpotString($value, string $path, bool $nullable = false): void
    {
        if ($value === null && $nullable) {
            return;
        }

        $this->assertString($value, $path);

        if (!preg_match('/^[HV][0-9]{1,2}$/', $value)) {
            throw new SchemaValidationException($path . ' must match yardline pattern (e.g., H35)');
        }
    }

    /**
     * @param mixed $value
     */
    private function assertClock($value, string $path, bool $nullable = false): void
    {
        if ($value === null && $nullable) {
            return;
        }

        $this->assertString($value, $path);

        if (!preg_match('/^[0-9]{1,2}:[0-9]{2}$/', $value)) {
            throw new SchemaValidationException($path . ' must match clock format MM:SS');
        }
    }

    /**
     * @param mixed $value
     */
    private function assertDateString($value, string $path, bool $nullable = false): void
    {
        if ($value === null && $nullable) {
            return;
        }

        $this->assertString($value, $path);

        if (!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/', $value)) {
            throw new SchemaValidationException($path . ' must be an ISO-8601 date (YYYY-MM-DD)');
        }
    }

    /**
     * @param mixed $value
     */
    private function assertDateTimeString($value, string $path, bool $nullable = false): void
    {
        if ($value === null && $nullable) {
            return;
        }

        $this->assertString($value, $path);

        if (!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/', $value)) {
            throw new SchemaValidationException($path . ' must be an ISO-8601 timestamp (YYYY-MM-DDTHH:MM:SSZ)');
        }
    }

    private function prefix(?string $resourceId, string $message): string
    {
        if ($resourceId === null) {
            return $message;
        }

        return '[' . $resourceId . '] ' . $message;
    }
}
