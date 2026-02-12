a = [1, 2, 3, 4, 5]
d = {}
for i in a:
    d[i] = 1
for i in range(1, 1000000):
    if d.get(i, 0) == 0:
        print(i)
        break
