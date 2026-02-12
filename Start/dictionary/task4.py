a = input()
c = 0
d = {}
for i in a.split():
    d[i] = d.get(i, 0) + 1
for k, v in d.items():
    if v >= c:
        c = v
        b = k
print(b)