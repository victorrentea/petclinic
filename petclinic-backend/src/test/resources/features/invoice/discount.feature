# language: es
Característica: Cálculo de descuentos en facturas
  Como recepcionista de la clínica
  Quiero que los descuentos se apliquen por artículo antes de totalizar la factura
  Para que los clientes paguen el importe correcto con descuento

  Escenario: Una factura sin artículos tiene total cero
    Dado una factura sin artículos
    Cuando se calcula el total
    Entonces el total es 0.00

  Escenario: Un artículo sin descuento
    Dado una factura con los siguientes artículos
      | nombre | precio | cantidad | descuento |
      | x      | 10.00  | 2        | 0.00      |
    Cuando se calcula el total
    Entonces el total es 20.00

  Escenario: El descuento se resta del precio antes de multiplicar por la cantidad
    Dado una factura con los siguientes artículos
      | nombre | precio | cantidad | descuento |
      | x      | 10.00  | 3        | 2.00      |
    Cuando se calcula el total
    Entonces el total es 24.00

  Escenario: El total es la suma de todos los artículos
    Dado una factura con los siguientes artículos
      | nombre | precio | cantidad | descuento |
      | a      | 5.00   | 2        | 0.00      |
      | b      | 8.00   | 1        | 1.00      |
    Cuando se calcula el total
    Entonces el total es 17.00
