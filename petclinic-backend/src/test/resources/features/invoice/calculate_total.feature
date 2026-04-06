# language: ro
Functionalitate: Calcul total factura

  Scenariu: Un produs, cantitate 1, fara discount
    Dat fiind ca factura are articolul "pantofi" cu pretul "50.00", cantitatea 1 si discountul "0.00"
    Cand calculez totalul
    Atunci totalul ar trebui sa fie "50.00"

  Scenariu: Un produs, cantitate 2, fara discount
    Dat fiind ca factura are articolul "pantofi" cu pretul "50.00", cantitatea 2 si discountul "0.00"
    Cand calculez totalul
    Atunci totalul ar trebui sa fie "100.00"

  Scenariu: Un produs, cantitate 2, cu discount pe bucata
    Dat fiind ca factura are articolul "pantofi" cu pretul "50.00", cantitatea 2 si discountul "5.00"
    Cand calculez totalul
    Atunci totalul ar trebui sa fie "90.00"

  Scenariu: Doua produse, mix cu si fara discount, cantitati 1 si 2
    Dat fiind ca factura are articolul "pantofi" cu pretul "50.00", cantitatea 1 si discountul "5.00"
    Si factura mai are articolul "socks" cu pretul "20.00", cantitatea 2 si discountul "0.00"
    Cand calculez totalul
    Atunci totalul ar trebui sa fie "85.00"
