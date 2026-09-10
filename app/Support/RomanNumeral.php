<?php

namespace App\Support;

class RomanNumeral
{
    protected static array $map = [
        1000 => 'M', 900 => 'CM', 500 => 'D', 400 => 'CD',
        100 => 'C', 90 => 'XC', 50 => 'L', 40 => 'XL',
        10 => 'X', 9 => 'IX', 5 => 'V', 4 => 'IV', 1 => 'I',
    ];

    public static function convert(int $number): string
    {
        if ($number <= 0) {
            return (string) $number;
        }

        $result = '';
        foreach (static::$map as $value => $symbol) {
            while ($number >= $value) {
                $result .= $symbol;
                $number -= $value;
            }
        }

        return $result;
    }
}