from math import sqrt
a = list(map(int,input().split()))
dem = 0
dem1 = 0
b = [0] * (max(a) + 1)
b[0] = 1
for i in range(2, int(sqrt(max(a)) + 1)):
    if b[i] == 0:
        for j in range(i * i, max(a) + 1, i):
            b[j] = 1
for i in a:
    if i == 1:
        b[i] = 1
    if b[i] != 1:
        dem = dem + 1
    elif i == int(sqrt(i) * sqrt(i)):
        dem1 = dem1 + 1
print(f"có {dem} so nguyen to va có {dem1} so chinh phuong ")