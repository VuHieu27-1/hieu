def mang(a ,b):
    c = range(a, b + 1)
    d = []
    for i in c:
        if i % 3 == 0 or i % 2 == 0:
            d.append(i)
    return d
a, b = list(map(int,input().split()))
print(*mang(a, b))