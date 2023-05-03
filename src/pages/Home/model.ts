import { MouseEvent } from 'react';
import {combine, createEffect, createEvent, createStore, guard, sample} from 'effector';
import {head, last, shuffle} from "lodash";

export interface Tube {
    balls: BallColor[];
}

const BALLS_IN_TUBE = 4;
const COLORS_IN_GAME = 4;
const countBallsOfTube = (count: number) => count + 2

export type BallColor =
    | 0
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11;

export const startClicked = createEvent<MouseEvent<HTMLButtonElement>>();
export const restartClicked = createEvent<MouseEvent<HTMLButtonElement>>();
export const toMainMenuClicked = createEvent<MouseEvent<HTMLButtonElement>>();
export const tubeClicked = createEvent<MouseEvent<HTMLDivElement>>();
const gameSuccessfully = createEvent()

const tubeSelected = tubeClicked.map((e) => parseInt(e.currentTarget.dataset.position ?? ''))

export const $state = createStore<'start' | 'ingame' | 'won'>('start')
export const $moves = createStore(0);

const generateTubesFx = createEffect<{colorsCount: number}, Tube[]>()

const $tubes = createStore<Tube[]>([])
const $currentSelectedTube = createStore<number | null>(null)

export const $fields = combine($tubes, $currentSelectedTube, (tubes, selectedIndex) => {
    return tubes.map((tube, index) => {
        const isCurrent = selectedIndex === index
        const over =  isCurrent ? head(tube.balls) : null
        const leftBalls = isCurrent ? tube.balls.slice(1) : tube.balls

        return ({balls: leftBalls, over, complete: isComplete(tube)})
    })
})

const $filledTubesCount = $fields.map((tubes) => tubes.filter(({complete}) => complete).length)

const isComplete = (tube: Tube): boolean => {
    if (tube.balls.length === BALLS_IN_TUBE) {
        const firstBall = head(tube.balls)

        return tube.balls.every((ball) => ball === firstBall)
    }

    return  false
}

$state.on(startClicked, () => 'ingame')

sample({
    clock: [startClicked, restartClicked],
    fn: () => ({colorsCount: BALLS_IN_TUBE}),
    target: generateTubesFx,
})

generateTubesFx.use(({colorsCount}) => {
    const tubesCount = countBallsOfTube(colorsCount)
    const availableBalls = shuffle(Array.from({length: BALLS_IN_TUBE * colorsCount}, (_, index) => index % BALLS_IN_TUBE))

    const fieldsTubes = Array.from({length: colorsCount}).map(() => ({balls: Array.from({length: BALLS_IN_TUBE}).map(() => availableBalls.pop())}))
    const emptyTubes = Array.from({length: tubesCount - colorsCount}, () => ({balls: []}))

    return [...fieldsTubes, ...emptyTubes]
})

$tubes.on(generateTubesFx.doneData, (_, tubes) => tubes)

// const currentTubeIndexChanged = sample({
//     clock: tubeSelected,
//     source: [$tubes, $currentSelectedTube],
//     fn: ([tubes, currentTubeIndex], tubeClicked) => {
//
//         if (tubes[tubeClicked].balls.length === 0) return currentTubeIndex
//
//         return tubeClicked === currentTubeIndex ? null : tubeClicked
//     },
//     target: $currentSelectedTube
// })

const tubeWillChange = sample({
    clock: tubeSelected,
    source: [$tubes, $currentSelectedTube],
    fn: ([tubes, currentIndex], selectedIndex) => ({
        tubes,
        currentIndex,
        selectedIndex,
    }),
});

const ballUplift = guard({
    source: tubeWillChange,
    filter({ tubes, currentIndex, selectedIndex }) {
        return currentIndex === null && tubes[selectedIndex].balls.length !== 0;
    },
});

$currentSelectedTube.on(
    ballUplift,
    (_, { selectedIndex }) => selectedIndex,
);

const ballDownliftBack = guard({
    source: tubeWillChange,
    filter({ currentIndex, selectedIndex }) {
        return currentIndex === selectedIndex;
    },
});

$currentSelectedTube.on(ballDownliftBack, () => null);

const ballMoved = guard({
    source: tubeWillChange,
    filter({ tubes, currentIndex, selectedIndex }) {
        if (currentIndex === null) return false;
        if (currentIndex === selectedIndex) return false;

        // we proofed that source tube is not empty
        // ballUplift triggered only when tube is not empty
        const sourceTube = tubes[currentIndex];
        const targetTube = tubes[selectedIndex];

        const sourceBall = head(sourceTube.balls);
        const targetBall = head(targetTube.balls);

        const isTargetTubeEmpty = targetBall === undefined;
        return isTargetTubeEmpty ? true : targetBall === sourceBall;
    },
});


$currentSelectedTube.on(ballMoved, (_, {selectedIndex}) => null)

$tubes.on(ballMoved, (_, {tubes, currentIndex, selectedIndex}) => {
    const sourceBall = head(tubes[currentIndex].balls)

    return tubes.map((tube, index) => {
        if (index === currentIndex) return {balls: tube.balls.slice(1)}
        if (index === selectedIndex) return {balls: [sourceBall, ...tube.balls]}

        return tube
    })
})

sample({
    clock: $filledTubesCount,
    filter: (filled) => filled === COLORS_IN_GAME,
    target: gameSuccessfully
})

$state.on(gameSuccessfully, () => 'won')

$moves.on(ballMoved, (count) => count + 1)
        .reset(restartClicked)

$currentSelectedTube.reset(restartClicked)

$state.on(toMainMenuClicked, () => 'start')