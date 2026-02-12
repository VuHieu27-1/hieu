a = [1, 7, 3, 3, 4, 4, 3, 1000]
d = {}
for i in a:
    d[i]= d.get(i, 0) + 1
for key, value in d.items():
    print(f"Số {key} xuất hiện {value} lần")