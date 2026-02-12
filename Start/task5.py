a = int(input("Nhap so n: "))
while a >= 1:
    if a == 2 or a == 1:
        print("YES")
        break
    if a % 2 != 0 :
        print("NO")
        break
    a //= 2
