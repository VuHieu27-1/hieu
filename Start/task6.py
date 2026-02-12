a = int(input())
if a > 9 and a < 100 :
    b = a // 10
    c = a % 10
    if b - c == 1 or c - b == 1:
        print("YES")
    else :
        print("NO")
else :
    print("NO")