import { expect, test } from 'vitest';
import { calculatorAnswer, initialCalculator, pressCalculator } from './engine';

const calculate = (keys: string[]) => keys.reduce(pressCalculator, initialCalculator());
const keys = (expression: string) => [...expression];

for (const [expression, result] of [
  ['2+3×4=', '14'], ['(2+3)×4=', '20'], ['((8−2)÷3)+1=', '3'],
  ['0,1+0,2=', '0.3'], ['1÷3=', '0.333333333333'], ['0.07×100=', '7'],
  ['10−3−2=', '5'], ['24÷3÷2=', '4'], ['5+×3=', '15'],
  ['123456789012×9=', '1.11111110111e+12'], ['0.000000001÷3=', '3.33333333333e-10'],
  ['2÷3=', '0.666666666667'], ['999999999999+1=', '1e+12'],
  ['.5+.25=', '0.75'], ['0×9=', '0'], ['2(3+4)=', '14'],
] as const) test(`арифметика ${expression}`, () => expect(calculate(keys(expression)).display).toBe(result));

for (const [sequence, result] of [
  [['9', '√', '+', '1', '='], '4'], [['5', '±', '×', '2', '='], '-10'],
  [['(', '9', '+', '7', ')', '√', '='], '4'], [['2', '√', '='], '1.41421356237'],
  [['2', '+', '3', '=', '4'], '4'], [['2', '+', '3', '=', '×', '2', '='], '10'],
  [['1', '2', '+', '3', '4', 'CE', '5', '='], '17'],
  [['5', 'M+', 'C', '2', 'M+', 'C', 'MR'], '7'],
  [['5', 'M+', 'C', 'MC', 'MR'], '0'], [['5', '±', '±'], '5'],
  [['9', '+', 'MR', '='], '9'], [['0', '√'], '0'],
] as const) test(`ввод ${sequence.join(' ')}`, () => expect(calculate([...sequence]).display).toBe(result));

for (const [expression, error] of [['1÷0=', 'division_zero'], ['9±√', 'negative_root'], ['(2+3=', 'parentheses'], ['2+3)=', 'parentheses'], ['2+=', 'incomplete']] as const) {
  test(`ошибка ${expression}`, () => {
    const state = calculate(keys(expression));
    expect(state.error).toBe(error);
    expect(pressCalculator(state, '7').display).toBe('7');
    expect(pressCalculator(state, '7').error).toBeNull();
  });
}

test('точная дробь сохраняется для следующего действия, перенос округляет только дисплей', () => {
  const third = calculate(keys('1÷3='));
  expect(calculatorAnswer(third)).toBe('0.333333333333');
  expect(['×', '3', '='].reduce(pressCalculator, third).display).toBe('1');
});
test('перенос разворачивает большие и малые числа без экспоненты', () => {
  expect(calculatorAnswer(calculate(keys('999999999999+1=')))).toBe('1000000000000');
  expect(calculatorAnswer(calculate(keys('0.000000001÷3=')))).toBe('0.000000000333333333333');
  expect(calculatorAnswer(calculate(keys('0=')))).toBe('0');
  expect(calculatorAnswer(initialCalculator())).toBeUndefined();
  expect(calculatorAnswer(calculate(keys('1÷0=')))).toBeUndefined();
});
test('12 значащих цифр ввода, повтор разделителя, ведущие и конечные нули', () => {
  expect(calculate(keys('00123.4500.=')).display).toBe('123.45');
  expect(calculate(keys('1234567890123')).display).toBe('123456789012');
  expect(calculate(keys('0.0000000001234567890123=')).display).toBe('1.23456789012e-10');
  expect(calculate(keys('5±2=')).display).toBe('-52');
});
test('границы диапазона, большой и малый корень, переполнение памяти', () => {
  const huge = calculate(keys('100000000000' + '×100000000000'.repeat(8) + '='));
  expect(huge.display).toBe('1e+99');
  expect(pressCalculator(huge, '√').display).toBe('3.16227766017e+49');
  expect(['×', '1', '0', '='].reduce(pressCalculator, huge).error).toBe('overflow');
  const tiny = calculate(keys('1' + '÷100000000000'.repeat(9) + '='));
  expect(tiny.display).toBe('1e-99');
  expect(pressCalculator(tiny, '√').display).toBe('3.16227766017e-50');
  expect(['÷', '1', '0', '='].reduce(pressCalculator, tiny).error).toBe('overflow');
  const nearLimit = ['×', ...keys('9.99999999999'), '=', 'M+'].reduce(pressCalculator, huge);
  expect(nearLimit.error).toBeNull();
  expect(pressCalculator(nearLimit, 'M+').error).toBe('overflow');
});
test('ошибки не принимают операторы, C и CE их снимают, MR сохраняет память', () => {
  const error = calculate([...keys('5'), 'M+', 'C', ...keys('1÷0=')]);
  expect(pressCalculator(error, '+')).toEqual(error);
  expect(pressCalculator(error, 'CE').error).toBeNull();
  expect(pressCalculator(error, 'C').error).toBeNull();
  expect(pressCalculator(error, 'MR').display).toBe('5');
  expect(pressCalculator(error, 'MC').memory.n).toBe(0n);
});
test('пустые действия, клавиатурные операторы, очистка результата и группы', () => {
  expect(calculate(['=', 'M+', '+', 'x']).display).toBe('');
  expect(calculate(['±', '±', '√']).display).toBe('0');
  expect(calculate(keys('-5*2/4=')).display).toBe('-2.5');
  expect(calculate([...keys('2+3='), 'CE']).display).toBe('');
  expect(calculate([...keys('(2+3)'), 'CE', ...keys('4=')]).display).toBe('4');
  expect(calculate([...keys('(2+3)'), 'M+', 'C', 'MR']).display).toBe('5');
  expect(calculate(keys('(2+3)±=')).display).toBe('-5');
  expect(calculate(keys('(2+3)4=')).display).toBe('20');
  expect(calculate(keys('2=+3==')).display).toBe('5');
  expect(calculate(keys('2=(3+4)=')).display).toBe('7');
  expect(calculate(['MR', '±', '=', '±']).display).toBe('0');
});
test('ввод и выражение ограничены, даже когда значащих цифр нет', () => {
  expect(calculate(['0', '.', ...Array<string>(112).fill('0')]).error).toBe('overflow');
  expect(calculate(Array<string>(257).fill('(')).error).toBe('overflow');
  expect(calculate(keys('1+()=')).error).toBe('parentheses');
  expect(calculate(keys('1+(2+=' )).error).toBe('incomplete');
});
