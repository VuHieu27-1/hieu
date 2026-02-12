a = int(input())
d = a
b = a % 10
a //= 10
c = a % 10
a //= 10
if a == 0:
    print("NO")
elif a < c and a < b and b > c:
    print("YES")
else :
    print("NO")